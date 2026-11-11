import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { ShareDrawer } from './ShareDrawer';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const open = '?overlay=feed-share&oid=7';
const rooms = [
  { roomId: 30, kind: 'DIRECT', title: '이도윤', avatarUrl: null },
  { roomId: 1, kind: 'TEAM', title: 'RESULTOT', avatarUrl: '/mock/cover-1.svg' },
  { roomId: 2, kind: 'TEAM', title: 'DAWN GUYS', avatarUrl: null },
];

beforeEach(() => {
  fetchMock.mockReset();
  resetOverlayHistory();
  useToastStore.setState({ toasts: [] });
});

it('lists every room in one list, marks team rooms with 팀, and has search + copy link', async () => {
  fetchMock.mockResolvedValue({ items: rooms });
  renderWithProviders(<ShareDrawer />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: open,
  });

  const drawer = await screen.findByRole('dialog', { name: '공유하기' });
  const list = await within(drawer).findByRole('list', { name: '공유할 채팅방' });
  const rows = within(list).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    '이도윤공유하기',
    'RESULTOT팀공유하기',
    'DAWN GUYS팀공유하기',
  ]);
  expect(within(drawer).queryByRole('tablist')).not.toBeInTheDocument();
  expect(within(drawer).getByRole('searchbox', { name: '채팅방 검색' })).toHaveAttribute(
    'placeholder',
    '검색어를 입력해 주세요',
  );
  expect(within(drawer).getByRole('button', { name: '링크 복사하기' })).toBeEnabled();
  expect(await axe(drawer)).toHaveNoViolations();
});

it('searches rooms by name on the server', async () => {
  fetchMock.mockResolvedValue({ items: rooms });
  const user = userEvent.setup();
  renderWithProviders(<ShareDrawer />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: open,
  });

  await user.type(await screen.findByRole('searchbox', { name: '채팅방 검색' }), 'dawn');
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([url]) => url.includes('q=dawn'))).toBe(true),
  );
});

it("sends the post card from a row's 공유하기, closes, and shows the 04 toast", async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/share-targets')) return { items: rooms };
    return { id: 100 };
  });
  const user = userEvent.setup();
  renderWithProviders(<ShareDrawer />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: open,
  });

  await user.click(await screen.findByRole('button', { name: 'DAWN GUYS에 공유하기' }));

  const sends = fetchMock.mock.calls.filter(([url]) => url.endsWith('/share-cards'));
  expect(sends).toHaveLength(1);
  expect(sends[0]![0]).toBe('/api/v1/user/chat-rooms/2/share-cards');
  expect(JSON.parse(sends[0]![1]!.body as string)).toEqual({
    targetType: 'POST',
    targetId: 7,
    clientMessageId: expect.stringMatching(/^[\da-f-]{36}$/),
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(useToastStore.getState().toasts[0]).toMatchObject({
    message: 'DAWN GUYS에 공유했어요.',
    action: { label: '채팅방으로 가기' },
  });
});

it('copies the public post link with ?from=share and closes', async () => {
  fetchMock.mockResolvedValue({ items: rooms });
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  renderWithProviders(<ShareDrawer />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: open,
  });

  await user.click(await screen.findByRole('button', { name: '링크 복사하기' }));

  expect(write).toHaveBeenCalledWith(`${window.location.origin}/posts/7?from=share`);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(useToastStore.getState().toasts[0]?.message).toBe('링크를 복사했어요');
});

it('shows the 04 empty copy when there is no room to share to', async () => {
  fetchMock.mockResolvedValue({ items: [] });
  renderWithProviders(<ShareDrawer />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: open,
  });
  expect(
    await screen.findByText(
      '공유할 수 있는 채팅방이 없어요. 팀에 참여하거나 대화를 시작해 보세요.',
    ),
  ).toBeVisible();
});
