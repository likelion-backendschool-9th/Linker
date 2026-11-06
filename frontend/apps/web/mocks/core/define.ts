import { ApiError } from '@/lib/api/api-error';
import type { MockRole } from '@/lib/auth/mock-viewer';

import type { MockViewer } from './viewer';

/**
 * Building blocks of a mock page file (blueprint §1-2). A page exports `routes: MockRoute[]`.
 * Permission comes from the URL prefix (`/public`, `/user`, `/recruiter`, `/admin`) like the real API;
 * `only: 'developer'` marks "developers only" writes.
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Every `:name` segment used in a mock path. Add a name here when a new route needs one. */
export type ParamName =
  | 'adId'
  | 'appealId'
  | 'applicationId'
  | 'caseId'
  | 'code'
  | 'commentId'
  | 'fileId'
  | 'issueId'
  | 'jobId'
  | 'kind'
  | 'linkId'
  | 'login'
  | 'messageId'
  | 'notificationId'
  | 'orderId'
  | 'paymentId'
  | 'postId'
  | 'recruitId'
  | 'repoId'
  | 'roomId'
  | 'sanctionId'
  | 'slug'
  | 'subscriptionId'
  | 'summaryId'
  | 'teamId'
  | 'templateKey'
  | 'token'
  | 'transferId'
  | 'userId';

export type MockContext = {
  /** `:name` segments of the path (a fixed key set, so reads are never `undefined`) */
  params: Record<ParamName, string>;
  query: URLSearchParams;
  /** Parsed JSON body, `{}` when there is none */
  body: Record<string, unknown>;
  viewer: MockViewer;
  /** Browser only: change who is logged in (sign-up, login, logout). A no-op on the server. */
  setMockRole: (role: MockRole) => void;
};

export type MockRoute = {
  method: Method;
  /** Path as written in WBS, with `:param` segments */
  path: string;
  only?: 'developer';
  handle: (ctx: MockContext) => unknown;
};

type Options = { only?: 'developer' };

const route =
  (method: Method) =>
  (path: string, handle: MockRoute['handle'], options: Options = {}): MockRoute => ({
    method,
    path,
    handle,
    ...options,
  });

export const get = route('GET');
export const post = route('POST');
export const put = route('PUT');
export const patch = route('PATCH');
export const del = route('DELETE');

/** Failure with the real error body, e.g. `fail(409, 'ALREADY_MEMBER', '이미 함께하는 팀이에요')` */
export function fail(
  status: number,
  code: string,
  message: string,
  detail?: Record<string, unknown>,
): never {
  throw new ApiError(status, { code, message, detail });
}

/** `{ items, nextCursor }` list convention (WBS §1-2): cursor is the next start index here. */
export function paginate<T>(items: T[], query: URLSearchParams, size = 20) {
  const start = Number(query.get('cursor') ?? 0) || 0;
  const next = start + size;
  return { items: items.slice(start, next), nextCursor: next < items.length ? String(next) : null };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** ISO time `n` units before now */
export const hoursAgo = (n: number) => new Date(Date.now() - n * HOUR).toISOString();
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
export const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();
export const daysFromNow = (n: number) => new Date(Date.now() + n * DAY).toISOString();

/** `YYYY-MM-DD` for a date `n` days from today (negative = past) */
export const dateOnly = (n: number) => daysFromNow(n).slice(0, 10);

let nextId = 9000;
/** Ids for rows created while mocks run; far above fixture ids */
export const newId = () => nextId++;
