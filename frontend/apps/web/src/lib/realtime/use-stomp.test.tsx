import { act, renderHook } from '@testing-library/react';

import { useStompSubscription } from './use-stomp';

type SubscribeEntry = {
  destination: string;
  onMessage: (body: unknown) => void;
  onResubscribe?: () => void;
};

const subscribe = vi.fn<(entry: SubscribeEntry) => () => void>();

vi.mock('./stomp-client', () => ({
  subscribe: (entry: SubscribeEntry) => subscribe(entry),
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

  expect(subscribe).toHaveBeenCalled();
  const entry = subscribe.mock.calls[0]![0];
  act(() => entry.onResubscribe?.());
  expect(onResubscribe).toHaveBeenCalledTimes(1);
});
