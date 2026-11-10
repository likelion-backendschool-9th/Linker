import { useAppSignalStore } from '@/stores/app-signal-store';
import { useToastStore } from '@/stores/toast-store';

import { ApiError } from './api-error';
import { RequestTimeoutError } from './fetch-with-timeout';
import { onMutationError, onQueryError } from './query-client';

beforeEach(() => {
  useAppSignalStore.setState({ loadTimedOutAt: 0, loadersMounted: 0, planLimit: null });
  useToastStore.setState({ toasts: [] });
});

const timeout = () => new RequestTimeoutError(10_000);

it('turns the loading on screen into the timeout screen instead of a toast', () => {
  useAppSignalStore.setState({ loadersMounted: 1 });
  onQueryError(timeout(), {});
  expect(useAppSignalStore.getState().loadTimedOutAt).toBeGreaterThan(0);
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

it('shows the timeout toast when nothing is loading on screen (side query, background refetch)', () => {
  onQueryError(timeout(), {});
  expect(useAppSignalStore.getState().loadTimedOutAt).toBe(0);
  expect(useToastStore.getState().toasts[0]).toMatchObject({
    message: '네트워크 연결 시간이 초과되었습니다.',
    tone: 'error',
  });
});

it('keeps app-chrome queries (badge counts) silent', () => {
  useAppSignalStore.setState({ loadersMounted: 1 });
  onQueryError(timeout(), { meta: { background: true } });
  expect(useAppSignalStore.getState().loadTimedOutAt).toBe(0);
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

const rateLimited = () =>
  new ApiError(429, {
    code: 'RATE_LIMITED',
    message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요',
  });

it('leaves codes a mutation handles itself (meta.handledCodes) to that mutation', () => {
  onMutationError(rateLimited(), undefined, undefined, {
    meta: { handledCodes: ['RATE_LIMITED'] },
  });
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

it('still shows the shared toast for mutations that do not handle the code', () => {
  onMutationError(rateLimited(), undefined, undefined, {});
  expect(useToastStore.getState().toasts).toHaveLength(1);
});

it('skips the shared plan-limit sheet when the screen shows PLAN_LIMIT itself (21 invite)', () => {
  const planLimit = new ApiError(403, {
    code: 'PLAN_LIMIT',
    message: '무료 팀은 멤버 6명까지예요.',
    detail: { reason: 'TEAM_MEMBERS' },
  });
  onMutationError(planLimit, undefined, undefined, { meta: { handledCodes: ['PLAN_LIMIT'] } });
  expect(useAppSignalStore.getState().planLimit).toBeNull();
  onMutationError(planLimit, undefined, undefined, {});
  expect(useAppSignalStore.getState().planLimit).toMatchObject({ reason: 'TEAM_MEMBERS' });
});
