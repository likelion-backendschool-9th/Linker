import { act, renderHook } from '@testing-library/react';

import { useStompSubscription } from './use-stomp';

const subscribe = vi.fn(() => vi.fn());

vi.mock('./stomp-client', () => ({
  subscribe: (...args: unknown[]) => subscribe(...args),
  getConnectionState: () => 'idle' as const,
  onConnectionStateChange: () => () => {},
}));

beforeEach(() => {
  subscribe.mockClear();
  subscribe.mockImplementation(() => vi.fn());
});

it('does not subscribe when disabled', () => {
  renderHook(() => useStompSubscription('/topic/a', vi.fn(), { enabled: false }));
  expect(subscribe).not.toHaveBeenCalled();
});

it('unsubscribes the previous destination when it changes', () => {
  const firstCleanup = vi.fn();
  const secondCleanup = vi.fn();
  subscribe.mockReturnValueOnce(firstCleanup).mockReturnValueOnce(secondCleanup);

  const { rerender, unmount } = renderHook(
    ({ destination }) => useStompSubscription(destination, vi.fn()),
    { initialProps: { destination: '/topic/a' } },
  );
  expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ destination: '/topic/a' }));

  rerender({ destination: '/topic/b' });
  expect(firstCleanup).toHaveBeenCalled();
  expect(subscribe).toHaveBeenLastCalledWith(expect.objectContaining({ destination: '/topic/b' }));

  unmount();
  expect(secondCleanup).toHaveBeenCalled();
});

it('forwards onResubscribe from the registry callback', () => {
  const onResubscribe = vi.fn();
  renderHook(() => useStompSubscription('/topic/a', vi.fn(), { onResubscribe }));

  const entry = subscribe.mock.calls[0]?.[0] as { onResubscribe?: () => void };
  act(() => entry.onResubscribe?.());
  expect(onResubscribe).toHaveBeenCalledTimes(1);
});
