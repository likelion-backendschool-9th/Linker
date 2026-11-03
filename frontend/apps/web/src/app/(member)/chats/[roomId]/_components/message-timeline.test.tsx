import { act, render } from '@testing-library/react';

import type { RoomMessage } from '../_lib/room-api';
import { MessageTimeline } from './message-timeline';

const { scrollToIndex, scrollToOffset } = vi.hoisted(() => ({
  scrollToIndex: vi.fn(), scrollToOffset: vi.fn(),
}));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [{ key: 1, index: 0, start: 0 }],
    getTotalSize: () => 2000,
    measureElement: vi.fn(), scrollToIndex, scrollToOffset,
  }),
}));
vi.mock('@/lib/navigation/use-overlay', () => ({ useActiveOverlay: () => ({ overlay: null }) }));
vi.mock('./chat-message', () => ({ ChatMessage: () => <p>대화</p> }));
const message = (id: number): RoomMessage => ({
  id, roomId: 1, unreadCount: 0, sender: null, type: 'TEXT', text: '긴 메시지', imageUrls: [], payload: null,
  createdAt: '2026-11-01T00:00:00Z', editedAt: null, deletedAt: null,
});
let notify: IntersectionObserverCallback;
beforeEach(() => {
  scrollToIndex.mockClear();
  scrollToOffset.mockClear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {} disconnect() {}
  });
});
afterEach(() => vi.unstubAllGlobals());

it('marks a tall message read when it fills half the viewport, despite its low intersection ratio', () => {
  const onRead = vi.fn();
  const { container } = render(<MessageTimeline kind="TEAM" messages={[message(1)]} login="me" onRead={onRead} />);
  const target = container.querySelector('[data-message-id]')!;
  const entry = {
    target, isIntersecting: true, intersectionRatio: 0.15,
    intersectionRect: { height: 300 }, boundingClientRect: { height: 2000 }, rootBounds: { height: 600 },
  } as unknown as IntersectionObserverEntry;
  act(() => notify([entry], {} as IntersectionObserver));
  expect(onRead).toHaveBeenCalledWith(1);
  onRead.mockClear();
  act(() => notify([{ ...entry, intersectionRect: { height: 20 } } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(onRead).not.toHaveBeenCalled();
});

it('restores the read position after a large catch-up instead of jumping to the latest message', () => {
  const messages = Array.from({ length: 601 }, (_, index) => message(index + 1));
  const { rerender } = render(<MessageTimeline kind="TEAM" messages={[messages[0]!]} login="me" onRead={vi.fn()} />);
  scrollToOffset.mockClear();
  rerender(<MessageTimeline kind="TEAM" messages={messages} login="me" onRead={vi.fn()} readPosition={{ id: 1 }} />);
  expect(scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' });
  expect(scrollToOffset).not.toHaveBeenCalled();
});
