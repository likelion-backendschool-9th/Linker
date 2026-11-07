import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';
import { ShareButton } from './ShareButton';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const target = { targetType: 'POST' as const, targetId: 1, path: '/posts/1' };
const room = { roomId: 1, kind: 'TEAM', title: '링커팀' };
const pickerUrl = '?overlay=share-room&oid=POST%3A1';

beforeEach(() => {
  fetchMock.mockReset();
  resetOverlayHistory();
  useToastStore.setState({ toasts: [] });
});

it('gives guests exactly two choices, copies a clean link, and prompts login for chat sharing', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<ShareButton target={target} />, {
    searchParams: '?overlay=share&oid=POST%3A1',
    onUrlUpdate,
  });
  const sheet = screen.getByRole('dialog', { name: '공유' });
  expect(
    within(sheet)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['닫기', '링크 복사', '채팅방에 공유']);
  await user.click(screen.getByRole('button', { name: '링크 복사' }));
  expect(write).toHaveBeenCalledWith(`${window.location.origin}/posts/1?from=share`);
  expect(useToastStore.getState().toasts[0]?.message).toBe('링크를 복사했어요');
  await user.click(screen.getByRole('button', { name: '공유' }));
  await user.click(await screen.findByRole('button', { name: '채팅방에 공유' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it('supports room search and sends once with the backend-required clientMessageId', async () => {
  let resolveSend!: (value: unknown) => void;
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/share-targets')) return { items: [room] };
    if (url.endsWith('/share-cards'))
      return new Promise((resolve) => {
        resolveSend = resolve;
      });
    throw new Error(url);
  });
  const user = userEvent.setup();
  renderWithProviders(<ShareButton target={target} />, {
    viewer: { role: 'developer', login: 'seojun' },
    searchParams: pickerUrl,
  });
  const input = screen.getByRole('searchbox', { name: '채팅방 이름' });
  expect(input).toHaveFocus();
  await user.type(input, '링커');
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/user/me/share-targets?q=%EB%A7%81%EC%BB%A4',
      expect.objectContaining({ cache: 'no-store' }),
    ),
  );
  const button = await screen.findByRole('button', { name: '링커팀 팀 채팅방에 공유' });
  expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  await user.dblClick(button);
  expect(button).toBeDisabled();
  const sends = fetchMock.mock.calls.filter(([url]) => url.endsWith('/share-cards'));
  expect(sends).toHaveLength(1);
  expect(JSON.parse(sends[0]![1]!.body as string)).toEqual({
    targetType: 'POST',
    targetId: 1,
    clientMessageId: expect.stringMatching(/^[\da-f-]{36}$/),
  });
  await act(async () => resolveSend({ id: 100 }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(useToastStore.getState().toasts[0]).toMatchObject({
    message: '링커팀에 공유했어요.',
    action: { label: '채팅방으로 가기' },
  });
});

it('retains the picker after a lost response and reuses the client id on explicit retry', async () => {
  let attempts = 0;
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/share-targets')) return { items: [room] };
    if (++attempts === 1)
      throw new ApiError(500, { code: 'UNKNOWN', message: '공유 응답을 받지 못했어요.' });
    return { id: 100 };
  });
  const user = userEvent.setup();
  renderWithProviders(<ShareButton target={target} />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
    searchParams: pickerUrl,
  });
  await user.click(await screen.findByRole('button', { name: /링커팀 팀 채팅방에 공유/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('공유 응답을 받지 못했어요.');
  expect(attempts).toBe(1);
  await user.click(screen.getByRole('button', { name: /링커팀 팀 채팅방에 공유/ }));
  await waitFor(() => expect(attempts).toBe(2));
  const requests = fetchMock.mock.calls.filter(([url]) => url.endsWith('/share-cards'));
  expect(JSON.parse(requests[0]![1]!.body as string).clientMessageId).toBe(
    JSON.parse(requests[1]![1]!.body as string).clientMessageId,
  );
});

it('shows empty/error states and disables sends for suspended accounts', async () => {
  fetchMock.mockResolvedValue({ items: [] });
  const { unmount } = renderWithProviders(<ShareButton target={target} />, {
    viewer: { role: 'developer' },
    searchParams: pickerUrl,
  });
  expect(
    await screen.findByText(
      '공유할 수 있는 채팅방이 없어요. 팀에 참여하거나 대화를 시작해 보세요.',
    ),
  ).toBeVisible();
  unmount();
  fetchMock.mockResolvedValue({ items: [room] });
  renderWithProviders(<ShareButton target={target} />, {
    viewer: { role: 'developer', status: 'SUSPENDED' },
    searchParams: pickerUrl,
  });
  expect(await screen.findByRole('button', { name: /링커팀 팀 채팅방에 공유/ })).toBeDisabled();
});
