import { queryOptions } from '@tanstack/react-query';

import type { UploadedImage } from '@/features/image-upload/upload-image';
import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional WBS 22 `PostController` contract; replace with Orval types when OpenAPI is available. */
export type EditorRepo = {
  repoId: number;
  fullName: string;
  language: string | null;
  stars: number;
  isFork: boolean;
  /** Forks show "포크" and the original (04 ch. 4 exceptions) */
  parentFullName?: string | null;
  teamId: number | null;
  /** One post per repo (POL-P-1) */
  alreadyPosted: boolean;
};

export type RepoSummary = {
  repoId: number;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  isFork: boolean;
  parentFullName: string | null;
  /** 0 also when the commit email isn't registered to GitHub (04 ch. 4 exceptions) */
  authorCommitCount: number;
  handledIssueCount: number;
  /** Proposal beyond WBS: my photo cap (5, Pro 10), so the picker can prompt before publishing */
  photoLimit: number;
};

export type PostRequest = {
  repoId: number;
  intro: string;
  body: string;
  /** In order; the first is the cover */
  photos: UploadedImage[];
  myRole: string | null;
  demoLinks: string[];
  /** `yyyy-MM` months */
  period: { start: string; end: string | null } | null;
  teamSize: number | null;
  tags: string[];
};

export type PostEditForm = Omit<PostRequest, 'repoId'> & {
  id: number;
  repo: Omit<RepoSummary, 'photoLimit'>;
  photoLimit: number;
};

export const postEditorKeys = {
  repos: (login: string | null, q: string, teamId: string | null) =>
    ['posts', login, 'editor', 'repos', q, teamId] as const,
  summary: (login: string | null, repoId: number) =>
    ['posts', login, 'editor', 'summary', repoId] as const,
  form: (login: string | null, postId: string) =>
    ['posts', login, 'editor', 'form', postId] as const,
};

/** Public repos of my account and my orgs; `teamId` narrows to a team (from 09's completion notice) */
export function editorReposOptions(login: string | null, q: string, teamId: string | null) {
  return queryOptions({
    queryKey: postEditorKeys.repos(login, q, teamId),
    queryFn: ({ signal }) => {
      const query = new URLSearchParams();
      if (q) query.set('q', q);
      if (teamId) query.set('teamId', teamId);
      return apiFetch<{ items: EditorRepo[] }>(
        `/api/v1/user/post-editor/repos${query.size ? `?${query}` : ''}`,
        { signal },
      );
    },
  });
}

export function repoSummaryOptions(login: string | null, repoId: number) {
  return queryOptions({
    queryKey: postEditorKeys.summary(login, repoId),
    queryFn: ({ signal }) =>
      apiFetch<RepoSummary>(`/api/v1/user/post-editor/repos/${repoId}/summary`, { signal }),
  });
}

export function postEditFormOptions(login: string | null, postId: string) {
  return queryOptions({
    queryKey: postEditorKeys.form(login, postId),
    queryFn: ({ signal }) =>
      apiFetch<PostEditForm>(`/api/v1/user/posts/${encodeURIComponent(postId)}/edit-form`, {
        signal,
      }),
  });
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** 10/day; photos over the cap → 403 PLAN_LIMIT opens the shared limit sheet */
export function createPost(request: PostRequest) {
  return apiFetch<{ id: number }>('/api/v1/user/posts', { method: 'POST', ...json(request) });
}

/** Edited posts show "수정됨" (POL-P-2); the repo can't change */
export function updatePost(postId: string, request: Omit<PostRequest, 'repoId'>) {
  return apiFetch<{ id: number }>(`/api/v1/user/posts/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    ...json(request),
  });
}
