import { queryOptions } from '@tanstack/react-query';

import type { RecruitFormat, RecruitGoal, RecruitRoleKey } from '@/features/recruit/recruit-labels';
import { apiFetch } from '@/lib/api/api-fetch';

/** Cancelled applications aren't listed (04 ch. 5 "Application status") */
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/** Provisional WBS 19/21 `RecruitmentController` contract; replace with Orval types when OpenAPI is available. */
export type RecruitSummary = {
  id: number;
  title: string;
  author: { id: number; login: string; name: string; avatarUrl: string };
  format: RecruitFormat;
  region: string | null;
  goal: RecruitGoal | null;
  /** `yyyy-MM-dd` in KST */
  deadline: string;
  status: 'OPEN' | 'CLOSED';
  techTags: string[];
  roles: {
    id: number;
    role: RecruitRoleKey;
    name: string;
    headcount: number;
    filled: number;
    remaining: number;
  }[];
  createdAt: string;
};

/** Team roster on the public detail (Figma 21 "팀원 프로필"); author is always included. */
export type RecruitTeamMember = RecruitSummary['author'] & {
  teamRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  /** True when this member is the recruit-post author */
  isAuthor: boolean;
};

/** Provisional WBS 21 `RecruitmentController` contract; replace with Orval types when OpenAPI is available. */
export type RecruitDetail = RecruitSummary & {
  intro: string;
  duration: string | null;
  teamName: string | null;
  authorCard: RecruitSummary['author'] & { bio: string | null };
  /** Linked team roster for the profile list; author-only when there is no team yet */
  teamMembers: RecruitTeamMember[];
  /** Logged in only; false for guests */
  isAuthor: boolean;
  isTeamMember: boolean;
  myApplication: {
    id: number;
    status: ApplicationStatus;
    roleId: number;
    teamChatRoomId: number | null;
  } | null;
  /** Pending applications, for the author's "지원자 N" tab */
  applicantCount: number;
};

export type ApplicantRow = {
  id: number;
  applicant: RecruitSummary['author'];
  roleId: number;
  roleName: string;
  status: ApplicationStatus;
  appliedAt: string;
  /** Days until the 14-day auto expiry (POL-R-4) */
  daysLeft: number;
};

export type ApplicationDetail = {
  id: number;
  status: ApplicationStatus;
  message: string;
  appliedAt: string;
  applicant: RecruitSummary['author'];
  /** Attached automatically (POL-R-3) */
  techStack: string[];
  completion: { projectCount: number; issueCompletionRate: number };
  contributions: { date: string; count: number }[];
  posts: { id: number; intro: string; repoFullName: string }[];
};

export type AcceptResult = { teamId: number; chatRoomId: number; needsGithubInvite: boolean };

const recruitPath = (recruitId: string) => `/api/v1/user/recruits/${encodeURIComponent(recruitId)}`;

export const detailKeys = {
  // Under ['recruits', login] so 19's invalidation (cancel) and 20's writes refresh it too
  detail: (login: string | null, recruitId: string) =>
    ['recruits', login, 'detail', recruitId] as const,
  applicants: (login: string | null, recruitId: string) =>
    ['recruits', login, 'detail', recruitId, 'applicants'] as const,
  application: (login: string | null, recruitId: string, applicationId: string) =>
    ['recruits', login, 'detail', recruitId, 'application', applicationId] as const,
};

/** Public: guests read it too; with a cookie it adds my application and author flags */
export function recruitDetailOptions(login: string | null, recruitId: string) {
  return queryOptions({
    queryKey: detailKeys.detail(login, recruitId),
    queryFn: ({ signal }) =>
      apiFetch<RecruitDetail>(`/api/v1/public/recruits/${encodeURIComponent(recruitId)}`, {
        signal,
      }),
  });
}

/** Author only; filtered by role on the client so the counts per role stay visible */
export function applicantsOptions(login: string | null, recruitId: string) {
  return queryOptions({
    queryKey: detailKeys.applicants(login, recruitId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: ApplicantRow[] }>(`${recruitPath(recruitId)}/applications`, { signal }),
  });
}

export function applicationOptions(login: string | null, recruitId: string, applicationId: string) {
  return queryOptions({
    queryKey: detailKeys.application(login, recruitId, applicationId),
    queryFn: ({ signal }) =>
      apiFetch<ApplicationDetail>(
        `${recruitPath(recruitId)}/applications/${encodeURIComponent(applicationId)}`,
        { signal },
      ),
  });
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** One role + message (300 chars), 20/day, one re-apply after cancelling (POL-R-3) */
export function applyToRecruit(recruitId: string, body: { roleId: number; message: string }) {
  return apiFetch<{ id: number; status: ApplicationStatus }>(
    `${recruitPath(recruitId)}/applications`,
    { method: 'POST', ...json(body) },
  );
}

/**
 * Accept → team member + team chat + notification. Fails with TEAM_REQUIRED or ROLE_FULL (409), or
 * PLAN_LIMIT for a free team at its member cap. `increaseHeadcount` ("인원 늘리고 수락") is a proposal
 * beyond WBS so the headcount and the acceptance change together.
 */
export function acceptApplication(
  recruitId: string,
  applicationId: number,
  options: { increaseHeadcount?: boolean } = {},
) {
  return apiFetch<AcceptResult>(`${recruitPath(recruitId)}/applications/${applicationId}/accept`, {
    method: 'POST',
    ...json(options),
  });
}

/** The reason stays with the author; the applicant only sees the fixed copy (POL-R-4) */
export function rejectApplication(recruitId: string, applicationId: number, reason: string) {
  return apiFetch<void>(`${recruitPath(recruitId)}/applications/${applicationId}/reject`, {
    method: 'POST',
    ...json({ reason: reason.trim() || null }),
  });
}

/** Borrowed from 09: only the GitHub org owner can send it (POL-R-4, never sent automatically) */
export function sendGithubInvite(teamId: number, userId: number) {
  return apiFetch<{ sent: boolean }>(
    `/api/v1/user/teams/${teamId}/members/${userId}/github-invitation`,
    { method: 'POST' },
  );
}

/** Only while pending (POL-R-3); also borrowed by 19's list tabs */
export function cancelApplication(applicationId: number) {
  return apiFetch<void>(`/api/v1/user/me/applications/${applicationId}`, { method: 'DELETE' });
}
