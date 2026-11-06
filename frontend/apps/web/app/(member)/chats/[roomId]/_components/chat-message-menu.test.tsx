import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders as render } from '@/test/render-with-providers';

import type { RoomMessage } from '../_lib/room-api';
import { ChatMessage } from './chat-message/ChatMessage';

const message: RoomMessage = { id: 10, roomId: 1, unreadCount: 2, sender: { id: 1, login: 'me', name: '나', avatarUrl: '' }, type: 'TEXT', text: '안녕하세요', imageUrls: [], payload: null, createdAt: '2026-11-03T06:12:00Z', editedAt: null, deletedAt: null };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const down = (element: HTMLElement) => fireEvent.pointerDown(element, { pointerType: 'touch', pointerId: 1, button: 0, clientX: 10, clientY: 10 });
it('opens the menu on desktop right click, not an ordinary click', () => {
  const onMenu = vi.fn();
  render(<ChatMessage message={message} mine kind="TEAM" onMenu={onMenu} />);
  const bubble = screen.getByRole('group', { name: '나 메시지' });
  expect(screen.getByText('오후 3:12')).toBeInTheDocument();
  fireEvent.click(bubble);
  expect(onMenu).not.toHaveBeenCalled();
  expect(fireEvent.contextMenu(bubble)).toBe(false);
  expect(onMenu).toHaveBeenCalledExactlyOnceWith(10);
});
it('opens once on a touch hold and suppresses the photo click that follows', () => {
  const onMenu = vi.fn();
  const onPhoto = vi.fn();
  render(<ChatMessage message={{ ...message, type: 'IMAGE', imageUrls: ['/mock/cover-1.svg'] }} mine kind="TEAM" onMenu={onMenu} onPhoto={onPhoto} />);
  const photo = screen.getByRole('button', { name: '채팅 이미지 1 크게 보기' });
  down(photo);
  act(() => { vi.advanceTimersByTime(499); });
  expect(onMenu).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(1); });
  fireEvent.contextMenu(photo);
  fireEvent.pointerUp(photo);
  fireEvent.click(photo);
  expect(onMenu).toHaveBeenCalledExactlyOnceWith(10);
  expect(onPhoto).not.toHaveBeenCalled();
  down(photo);
  fireEvent.pointerUp(photo);
  fireEvent.click(photo);
  expect(onPhoto).toHaveBeenCalledExactlyOnceWith(10, 0);
});
it.each(['move', 'cancel', 'scroll', 'release', 'second-touch'])('cancels a hold on %s', (action) => {
  const onMenu = vi.fn();
  render(<ChatMessage message={message} mine kind="TEAM" onMenu={onMenu} />);
  const bubble = screen.getByRole('group', { name: '나 메시지' });
  down(bubble);
  if (action === 'move') fireEvent.pointerMove(bubble, { pointerType: 'touch', clientX: 10, clientY: 40 });
  if (action === 'cancel') fireEvent.pointerCancel(bubble);
  if (action === 'scroll') fireEvent.scroll(window);
  if (action === 'release') fireEvent.pointerUp(bubble);
  if (action === 'second-touch') fireEvent.pointerDown(window, { pointerType: 'touch', pointerId: 2, isPrimary: false });
  act(() => { vi.advanceTimersByTime(600); });
  expect(onMenu).not.toHaveBeenCalled();
});
it('cancels pending holds when the virtualized message unmounts', () => {
  const onMenu = vi.fn();
  const { unmount } = render(<ChatMessage message={message} mine kind="TEAM" onMenu={onMenu} />);
  down(screen.getByRole('group', { name: '나 메시지' }));
  unmount();
  act(() => { vi.advanceTimersByTime(600); });
  expect(onMenu).not.toHaveBeenCalled();
});
it('supports keyboard menu shortcuts without hijacking nested links and photos', () => {
  const onMenu = vi.fn();
  render(<ChatMessage message={{ ...message, imageUrls: ['/mock/cover-1.svg'] }} mine kind="TEAM" onMenu={onMenu} />);
  const bubble = screen.getByRole('group', { name: '나 메시지' });
  fireEvent.keyDown(bubble, { key: 'F10', shiftKey: true });
  fireEvent.keyDown(bubble, { key: 'Enter' });
  fireEvent.keyDown(bubble, { key: ' ' });
  fireEvent.keyDown(screen.getByRole('button', { name: '채팅 이미지 1 크게 보기' }), { key: 'Enter' });
  expect(onMenu).toHaveBeenCalledTimes(3);
});
it.each([{ type: 'PR_EVENT' as const }, { type: 'SYSTEM' as const }, { deletedAt: '2026-11-03' }, { visibility: 'HIDDEN' as const }])('does not open actions for protected messages', (state) => {
  const onMenu = vi.fn();
  const { container } = render(<ChatMessage message={{ ...message, ...state }} mine kind="TEAM" onMenu={onMenu} />);
  const bubble = container.querySelector('[role="group"]')!;
  fireEvent.contextMenu(bubble);
  fireEvent.keyDown(bubble, { key: 'Enter' });
  expect(onMenu).not.toHaveBeenCalled();
});

it('keeps an accessible action for assistive technology without showing an ellipsis button', () => {
  const onMenu = vi.fn();
  render(<ChatMessage message={message} mine kind="TEAM" onMenu={onMenu} />);
  const trigger = screen.getByRole('button', { name: '나 메시지 메뉴' });
  expect(trigger).toHaveClass('sr-only');
  fireEvent.click(trigger);
  expect(onMenu).toHaveBeenCalledExactlyOnceWith(10);
});

it('blocks a delayed touch click on the newly opened sheet but allows the next deliberate tap', () => {
  const onAction = vi.fn();
  render(<><ChatMessage message={message} mine kind="TEAM" onMenu={vi.fn()} /><button onClick={onAction}>메뉴 동작</button></>);
  down(screen.getByRole('group', { name: '나 메시지' }));
  act(() => { vi.advanceTimersByTime(500); });
  const action = screen.getByRole('button', { name: '메뉴 동작' });
  fireEvent.click(action, { detail: 1 });
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.pointerDown(action, { pointerType: 'touch', pointerId: 2 });
  fireEvent.click(action, { detail: 1 });
  expect(onAction).toHaveBeenCalledOnce();
});
