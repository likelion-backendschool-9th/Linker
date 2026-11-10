import type { ChatPullRequest } from '@linker/api/openAPIDefinition.schemas';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { PullRequestSheet } from './PullRequestSheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const { subscribe } = vi.hoisted(() => ({
  subscribe:
    vi.fn<
      (entry: {
        destination: string;
        onMessage: (body: unknown) => void;
        onResubscribe?: () => void;
      }) => () => void
    >(),
}));
vi.mock('@/lib/realtime/stomp-client', () => ({ subscribe }));
const row = (state: 'open' | 'merged'): ChatPullRequest => ({
  id: 11,
  repoId: 12,
  githubRepoId: 901,
  githubPrId: 902,
  repo: 'linker-test-org/server',
  number: 42,
  title: state === 'open' ? '실제 API 필드의 열린 PR' : '실제 API 필드의 병합 PR',
  state,
  draft: false,
  author: 'D-Gyun103',
  url: 'https://github.com/linker-test-org/server/pull/42',
  githubUpdatedAt: '2026-11-09T10:00:00Z',
});

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  subscribe.mockReset();
  subscribe.mockImplementation(() => vi.fn());
  resetOverlayHistory();
});

it('refreshes the open list on this room’s PR event and reads the current merged list', async () => {
  let merged = false;
  vi.mocked(apiFetch).mockImplementation(async (url: string) => ({
    items: url.includes('state=merged')
      ? merged
        ? [row('merged')]
        : []
      : merged
        ? []
        : [row('open')],
  }));
  renderWithProviders(<PullRequestSheet roomId={7} login="me" onShare={vi.fn()} />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await screen.findByText('#42 실제 API 필드의 열린 PR');
  const entry = subscribe.mock.calls.at(-1)![0];
  expect(entry.destination).toBe('/topic/chat-rooms/7');
  const before = vi.mocked(apiFetch).mock.calls.length;
  act(() => {
    entry.onMessage({ event: 'READ', message: { type: 'PR_EVENT', roomId: 7 } });
    entry.onMessage({ event: 'MESSAGE', message: { type: 'TEXT', roomId: 7 } });
    entry.onMessage({ event: 'MESSAGE', message: { type: 'PR_EVENT', roomId: 8 } });
  });
  expect(apiFetch).toHaveBeenCalledTimes(before);
  merged = true;
  act(() => entry.onMessage({ event: 'MESSAGE', message: { type: 'PR_EVENT', roomId: 7 } }));
  expect(await screen.findByText('열린 PR이 없어요.')).toBeVisible();
  expect(screen.getByRole('button', { name: '팀에 공유 하기' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '병합 된 PR' }));
  expect(await screen.findByText('#42 실제 API 필드의 병합 PR')).toBeVisible();
});

it('reloads after STOMP resubscription and does not subscribe while the screen is closed', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [row('open')] });
  const closed = renderWithProviders(<PullRequestSheet roomId={7} login="me" />);
  expect(subscribe).not.toHaveBeenCalled();
  closed.unmount();
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await screen.findByRole('radio');
  vi.mocked(apiFetch).mockResolvedValue({ items: [] });
  act(() => subscribe.mock.calls.at(-1)![0].onResubscribe?.());
  expect(await screen.findByText('열린 PR이 없어요.')).toBeVisible();
});

it('uses the generated B API and renders open/merged records with repository, number and author', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => ({
    items: [row(url.includes('state=merged') ? 'merged' : 'open')],
  }));
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  expect(await screen.findByText('#42 실제 API 필드의 열린 PR')).toBeVisible();
  expect(screen.getByText('담당자 D-Gyun103님이')).toBeVisible();
  expect(vi.mocked(apiFetch).mock.calls[0]![0]).toBe(
    '/api/v1/user/chat-rooms/7/pull-requests?state=open',
  );
  await userEvent.click(screen.getByRole('button', { name: '병합 된 PR' }));
  expect(await screen.findByText('#42 실제 API 필드의 병합 PR')).toBeVisible();
  expect(vi.mocked(apiFetch).mock.calls.at(-1)![0]).toBe(
    '/api/v1/user/chat-rooms/7/pull-requests?state=merged',
  );
});

it('does not fetch hidden sheets and keeps the empty states distinct', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [] });
  const closed = renderWithProviders(<PullRequestSheet roomId={7} login="me" />);
  await waitFor(() => expect(apiFetch).not.toHaveBeenCalled());
  closed.unmount();
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests&pr=merged',
  });
  expect(await screen.findByText('병합된 PR이 없어요.')).toBeVisible();
});

it('does not display another room’s data when access fails', async () => {
  vi.mocked(apiFetch).mockRejectedValue(
    new ApiError(404, { code: 'NOT_FOUND', message: '팀 채팅방을 찾지 못했어요' }),
  );
  renderWithProviders(<PullRequestSheet roomId={7} login="outsider" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeVisible();
  expect(screen.queryByText('#42 실제 API 필드의 열린 PR')).not.toBeInTheDocument();
});

it('hands the record’s GitHub URL to the existing external-link sheet', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [row('open')] });
  const changed = vi.fn();
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
    onUrlUpdate: changed,
  });
  await userEvent.click(await screen.findByRole('button', { name: /GitHub에서 열기/ }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  const url = changed.mock.calls.at(-1)![0].searchParams as URLSearchParams;
  expect(url.get('overlay')).toBe('external-link');
  expect(url.get('oid')).toBe(row('open').url);
});

it('shares only the selected PR URL through the provided chat sender', async () => {
  const send = vi.fn();
  const first = row('open');
  const second = {
    ...first,
    id: 22,
    number: 43,
    title: '선택한 PR',
    url: 'https://github.com/linker-test-org/server/pull/43',
  };
  vi.mocked(apiFetch).mockResolvedValue({ items: [first, second] });
  renderWithProviders(<PullRequestSheet roomId={7} login="me" onShare={send} />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await userEvent.click(await screen.findByRole('radio', { name: /#43/ }));
  await userEvent.click(screen.getByRole('button', { name: '팀에 공유 하기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith(second.url);
  expect(
    vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
  ).toBe(true);
});

it.each(['', '&selectedPr=999'])(
  'keeps sharing disabled without a current explicit selection (%s)',
  async (selection) => {
    const send = vi.fn();
    vi.mocked(apiFetch).mockResolvedValue({ items: [row('open')] });
    renderWithProviders(<PullRequestSheet roomId={7} login="me" onShare={send} />, {
      searchParams: `?overlay=chat-pull-requests${selection}`,
    });
    expect(await screen.findByRole('radio')).not.toBeChecked();
    const share = screen.getByRole('button', { name: '팀에 공유 하기' });
    expect(share).toBeDisabled();
    await userEvent.click(share);
    expect(send).not.toHaveBeenCalled();
  },
);

it('clears the selection on a tab switch even when the same PR ID is returned', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => ({
    items: [row(url.includes('state=merged') ? 'merged' : 'open')],
  }));
  renderWithProviders(<PullRequestSheet roomId={7} login="me" onShare={vi.fn()} />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await userEvent.click(await screen.findByRole('radio'));
  expect(screen.getByRole('button', { name: '팀에 공유 하기' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: '병합 된 PR' }));
  await screen.findByText('#42 실제 API 필드의 병합 PR');
  expect(screen.getByRole('radio')).not.toBeChecked();
  expect(screen.getByRole('button', { name: '팀에 공유 하기' })).toBeDisabled();
});

it('blocks sharing during refresh and does not substitute another PR when the selected record disappears', async () => {
  const send = vi.fn();
  const other = {
    ...row('open'),
    id: 22,
    number: 43,
    title: '다른 PR',
    url: 'https://github.com/linker-test-org/server/pull/43',
  };
  let finish!: (value: { items: ChatPullRequest[] }) => void;
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({ items: [row('open'), other] })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  renderWithProviders(<PullRequestSheet roomId={7} login="me" onShare={send} />, {
    searchParams: '?overlay=chat-pull-requests&selectedPr=11',
  });
  expect(await screen.findByRole('radio', { name: /#42/ })).toBeChecked();
  const share = screen.getByRole('button', { name: '팀에 공유 하기' });
  await waitFor(() => expect(share).toBeEnabled());
  act(() => subscribe.mock.calls.at(-1)![0].onResubscribe?.());
  await waitFor(() => expect(share).toBeDisabled());
  await userEvent.click(share);
  expect(send).not.toHaveBeenCalled();
  await act(async () => finish({ items: [other] }));
  await waitFor(() => expect(screen.queryByRole('radio', { name: /#42/ })).not.toBeInTheDocument());
  expect(screen.getByRole('radio', { name: /#43/ })).not.toBeChecked();
  expect(share).toBeDisabled();
});
it('keeps viewing available in a read-only room while sharing is disabled', async () => {
  const send = vi.fn();
  vi.mocked(apiFetch).mockResolvedValue({ items: [row('open')] });
  renderWithProviders(<PullRequestSheet roomId={7} login="me" disabled onShare={send} />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await userEvent.click(await screen.findByRole('radio'));
  expect(screen.getByRole('button', { name: '팀에 공유 하기' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '팀에 공유 하기' }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /GitHub에서 열기/ })).toBeEnabled();
});
it('renders the GitHub update timestamp and tolerates an older server during rollout', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [row('open')] });
  const current = renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  await screen.findByRole('radio');
  expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-11-09T19:00:00+09:00');
  current.unmount();
  const legacy = { ...row('open'), githubUpdatedAt: undefined };
  vi.mocked(apiFetch).mockResolvedValue({ items: [legacy] });
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  expect(await screen.findByRole('radio')).toBeVisible();
  expect(document.querySelector('time')).not.toBeInTheDocument();
});
