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

export type AcceptResult = { teamId: number; chatRoomId: number; needsGithubInvite: boolean };

/** `githubSent`: whether the automatic GitHub org invite went out (only when `needsGithubInvite`) */
export type InviteResult = AcceptResult & { githubSent: boolean };

const recruitPath = (recruitId: string) => `/api/v1/user/recruits/${encodeURIComponent(recruitId)}`;

export const detailKeys = {
  // Under ['recruits', login] so 19's invalidation (cancel) and 20's writes refresh it too
  detail: (login: string | null, recruitId: string) =>
    ['recruits', login, 'detail', recruitId] as const,
  applicants: (login: string | null, recruitId: string) =>
    ['recruits', login, 'detail', recruitId, 'applicants'] as const,
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

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** One open role, 20/day, one re-apply after cancelling. No free-text message (POL-R-3). A full role → 409 ROLE_FULL. */
export function applyToRecruit(recruitId: string, body: { roleId: number }) {
  return apiFetch<{ id: number; status: ApplicationStatus }>(
    `${recruitPath(recruitId)}/applications`,
    { method: 'POST', ...json(body) },
  );
}

/**
 * Accept → team member + team chat + notification. Fails with TEAM_REQUIRED, ROLE_FULL or NOT_PENDING
 * (409), or PLAN_LIMIT (`TEAM_MEMBERS` / `ROLE_HEADCOUNT` / `TEAMS_PER_USER`, shown on 21 as a reason
 * only). `increaseHeadcount` bumps the role cap by one only on Flex teams.
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

/** No reason (POL-R-4); the applicant only sees the fixed copy */
export function rejectApplication(recruitId: string, applicationId: number) {
  return apiFetch<void>(`${recruitPath(recruitId)}/applications/${applicationId}/reject`, {
    method: 'POST',
  });
}

/** Borrowed from 09: only the GitHub org owner can send it (POL-R-4) */
export function sendGithubInvite(teamId: number, userId: number) {
  return apiFetch<{ sent: boolean }>(
    `/api/v1/user/teams/${teamId}/members/${userId}/github-invitation`,
    { method: 'POST' },
  );
}

/**
 * 21 "초대하기" (both the drawer and "인원 늘리고 초대"): accept, then send the GitHub org invite
 * automatically when the author is the team owner (POL-R-4). The team invite already stands, so a
 * failed GitHub invite comes back as `githubSent: false` instead of failing the whole invite.
 */
export async function inviteApplicant(
  recruitId: string,
  applicationId: number,
  applicantId: number,
  options: { increaseHeadcount?: boolean } = {},
): Promise<InviteResult> {
  const result = await acceptApplication(recruitId, applicationId, options);
  if (!result.needsGithubInvite) return { ...result, githubSent: false };
  const githubSent = await sendGithubInvite(result.teamId, applicantId).then(
    () => true,
    () => false,
  );
  return { ...result, githubSent };
}

/** Only while pending (POL-R-3); also borrowed by 19's list tabs */
export function cancelApplication(applicationId: number) {
  return apiFetch<void>(`/api/v1/user/me/applications/${applicationId}`, { method: 'DELETE' });
}
