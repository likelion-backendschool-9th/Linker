import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import type { RoomMessage } from '../../_lib/room-api';
import { ChatMessage } from '../chat-message';
import { continuesPrGroup, prEventDetails, PR_EVENTS } from './model';
import { PrEventCard } from './PrEventCard';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const eventMessage = (event: keyof typeof PR_EVENTS = 'OPENED'): RoomMessage => ({
  id: 42,
  roomId: 1,
  type: 'PR_EVENT',
  sender: null,
  imageUrls: [],
  unreadCount: 0,
  text: `PR #31 "feat: 로그인 시트" · ${PR_EVENTS[event].verb}`,
  payload: {
    event,
    repo: 'linker-hack/linker-web',
    prNumber: 31,
    url: 'https://github.com/linker-hack/linker-web/pull/31',
  },
  createdAt: '2026-11-09T10:00:00Z',
  updatedAt: '2026-11-09T10:00:00Z',
  editedAt: null,
  deletedAt: null,
  clientMessageId: null,
  visibility: 'VISIBLE',
});
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockResolvedValue({
    items: [{ id: 1, chatRoomId: 1, orgAvatarUrl: '/mock/avatar-1.svg' }],
  });
});
it.each([
  ['OPENED', 'PR이 생성 되었습니다'],
  ['REVIEW_REQUESTED', 'PR이 리뷰를 기다리고 있습니다'],
  ['MERGED', 'PR이 병합 되었습니다'],
  ['CLOSED', 'PR이 닫혔습니다'],
] as const)('renders the Figma %s copy from the existing server message', async (event, label) => {
  renderWithProviders(<PrEventCard message={eventMessage(event)} />);
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByText('#31 feat: 로그인 시트')).toBeVisible();
  expect(screen.getByText('linker-web')).toHaveAttribute('title', 'linker-hack/linker-web');
  expect(screen.getByText('linker-hack')).toBeVisible();
  expect(screen.queryByText(/· 열렸어요|· 리뷰가 요청됐어요|· 병합됐어요|· 닫혔어요/)).toBeNull();
  await waitFor(() =>
    expect(document.querySelector('img[alt=""]')).toHaveAttribute(
      'src',
      expect.stringContaining('avatar-1.svg'),
    ),
  );
  expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-09T19:00:00+09:00');
});
it('preserves quotes and PR numbers inside the title and leaves unknown legacy text intact', () => {
  const message = eventMessage();
  message.text = 'PR #31 "PR #2 \\"quoted\\" · 열렸어요" · 열렸어요';
  expect(prEventDetails(message).title).toBe('PR #2 \\"quoted\\" · 열렸어요');
  expect(prEventDetails({ ...message, text: '원문 형식' }).title).toBe('원문 형식');
});
it('groups only adjacent visible events of the same organization, room and KST day', () => {
  const first = eventMessage();
  const second = eventMessage('MERGED');
  expect(continuesPrGroup(first, second)).toBe(true);
  expect(
    continuesPrGroup(first, { ...second, payload: { ...second.payload, repo: 'other/repo' } }),
  ).toBe(false);
  expect(continuesPrGroup({ ...first, type: 'TEXT' }, second)).toBe(false);
  expect(continuesPrGroup({ ...first, visibility: 'HIDDEN' }, second)).toBe(false);
  expect(continuesPrGroup({ ...first, deletedAt: first.createdAt }, second)).toBe(false);
  expect(continuesPrGroup({ ...first, roomId: 2 }, second)).toBe(false);
  expect(continuesPrGroup(first, { ...second, createdAt: '2026-11-09T15:00:00Z' })).toBe(false);
  expect(continuesPrGroup(first, undefined)).toBe(false);
});
it('does not repeat organization identity or its query inside a group', () => {
  renderWithProviders(
    <PrEventCard message={eventMessage('MERGED')} previousMessage={eventMessage()} />,
  );
  expect(screen.queryByText('linker-hack', { exact: true })).toBeNull();
  expect(screen.getByText('#31 feat: 로그인 시트')).toBeVisible();
  expect(apiFetch).not.toHaveBeenCalled();
});
it('keeps the card usable when the organization photo is unavailable', async () => {
  const { container } = renderWithProviders(<PrEventCard message={eventMessage()} />);
  await waitFor(() =>
    expect(container.querySelector('img[alt=""]')).toHaveAttribute(
      'src',
      expect.stringContaining('avatar-1.svg'),
    ),
  );
  fireEvent.error(container.querySelector('img[alt=""]')!);
  expect(screen.getByText('l', { exact: true })).toBeVisible();
  expect(screen.getByRole('button', { name: /GitHub에서 열기/ })).toBeEnabled();
});
it('opens the existing external-link overlay and never exposes regular message actions', async () => {
  const changed = vi.fn();
  const onMenu = vi.fn();
  renderWithProviders(
    <ChatMessage message={eventMessage()} kind="TEAM" mine={false} onMenu={onMenu} />,
    { onUrlUpdate: changed },
  );
  const button = screen.getByRole('button', { name: /GitHub에서 열기/ });
  fireEvent.contextMenu(button);
  expect(onMenu).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /메시지 메뉴/ })).toBeNull();
  await userEvent.click(button);
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(changed.mock.calls.at(-1)![0].searchParams.get('overlay')).toBe('external-link');
  expect(changed.mock.calls.at(-1)![0].searchParams.get('oid')).toBe(eventMessage().payload?.url);
});
