import { ApiError } from '@/lib/api/api-error';
import { RequestTimeoutError } from '@/lib/api/fetch-with-timeout';

import { RECRUIT_STATUS_FAILURE, recruitStatusErrorMessage } from './recruit-status-errors';

const apiError = (status: number, code: string) => new ApiError(status, { code, message: code });

it('gives each reopen branch its own copy', () => {
  expect(recruitStatusErrorMessage(apiError(409, 'ROLES_FULL'))).toBe(
    '모집 인원이 모두 찼어요. 인원을 늘린 뒤 다시 열어 주세요.',
  );
  expect(recruitStatusErrorMessage(apiError(409, 'DEADLINE_PASSED'))).toBe(
    '마감일이 지났어요. 마감일을 바꾼 뒤 다시 열어 주세요.',
  );
  expect(recruitStatusErrorMessage(apiError(404, 'NOT_FOUND'))).toBe(
    '삭제되었거나 볼 수 없는 모집 글이에요.',
  );
});

it('stays quiet for codes the shared handler already answers', () => {
  expect(recruitStatusErrorMessage(apiError(403, 'PLAN_LIMIT'))).toBeNull();
  expect(recruitStatusErrorMessage(apiError(429, 'RATE_LIMITED'))).toBeNull();
  expect(recruitStatusErrorMessage(new RequestTimeoutError(10_000))).toBeNull();
});

it('falls back to the generic copy for anything else', () => {
  expect(recruitStatusErrorMessage(apiError(500, 'INTERNAL_ERROR'))).toBe(RECRUIT_STATUS_FAILURE);
  expect(recruitStatusErrorMessage(new Error('boom'))).toBe(RECRUIT_STATUS_FAILURE);
});
