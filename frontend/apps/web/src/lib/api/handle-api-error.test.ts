import { useAppSignalStore } from '@/stores/app-signal-store';

import { ApiError } from './api-error';
import { handleApiError } from './handle-api-error';

beforeEach(() => {
  useAppSignalStore.setState({
    loginRequestedAt: 0,
    planLimit: null,
    githubUnavailable: false,
    suspended: false,
  });
});

it('opens the login sheet signal on LOGIN_REQUIRED', () => {
  handleApiError(new ApiError(401, { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' }));
  expect(useAppSignalStore.getState().loginRequestedAt).toBeGreaterThan(0);
});

it('opens the shared plan-limit signal from PLAN_LIMIT detail.reason', () => {
  handleApiError(
    new ApiError(403, {
      code: 'PLAN_LIMIT',
      message: '사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.',
      detail: { reason: 'POST_PHOTOS' },
    }),
  );
  expect(useAppSignalStore.getState().planLimit).toEqual({
    reason: 'POST_PHOTOS',
    message: '사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.',
  });
});

it('uses an empty reason when PLAN_LIMIT has no detail', () => {
  handleApiError(
    new ApiError(403, {
      code: 'PLAN_LIMIT',
      message: 'Flex 구독 팀만 쓸 수 있어요.',
    }),
  );
  expect(useAppSignalStore.getState().planLimit).toEqual({
    reason: '',
    message: 'Flex 구독 팀만 쓸 수 있어요.',
  });
});
