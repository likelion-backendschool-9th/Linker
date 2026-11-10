import { useAppSignalStore } from '@/stores/app-signal-store';
import { useToastStore } from '@/stores/toast-store';

import { RequestTimeoutError } from './fetch-with-timeout';
import { onQueryError } from './query-client';

beforeEach(() => {
  useAppSignalStore.setState({ loadTimedOutAt: 0, loadersMounted: 0 });
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
