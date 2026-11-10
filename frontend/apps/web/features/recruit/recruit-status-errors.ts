import { ApiError } from '@/lib/api/api-error';
import { isTimeoutError } from '@/lib/api/fetch-with-timeout';

/**
 * Failure toasts for close / reopen / delete (WBS 4-11, page 20), shared by 20's status section and
 * 21's author menu. Each server branch gets its own copy so the author knows what to fix.
 */

/** Codes the shared handler already answers (sheet, banner or toast): nothing to add */
const SHARED_CODES = new Set([
  'PLAN_LIMIT',
  'RATE_LIMITED',
  'LOGIN_REQUIRED',
  'SUSPENDED',
  'GITHUB_UNAVAILABLE',
  'DEVELOPER_ONLY',
]);

const MESSAGES: Record<string, string> = {
  /** reopen: every role is filled */
  ROLES_FULL: '모집 인원이 모두 찼어요. 인원을 늘린 뒤 다시 열어 주세요.',
  /** reopen: the deadline is before today */
  DEADLINE_PASSED: '마감일이 지났어요. 마감일을 바꾼 뒤 다시 열어 주세요.',
  /** any: deleted or missing post */
  NOT_FOUND: '삭제되었거나 볼 수 없는 모집 글이에요.',
  /** any: not the author */
  FORBIDDEN: '내 모집 글만 마감·재개·삭제할 수 있어요.',
};

export const RECRUIT_STATUS_FAILURE = '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';

/** Toast copy for a failed close / reopen / delete, or `null` when the shared handler already said it */
export function recruitStatusErrorMessage(error: unknown): string | null {
  if (isTimeoutError(error)) return null;
  if (!(error instanceof ApiError)) return RECRUIT_STATUS_FAILURE;
  if (SHARED_CODES.has(error.code)) return null;
  return MESSAGES[error.code] ?? RECRUIT_STATUS_FAILURE;
}
