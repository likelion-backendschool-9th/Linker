import type { ChatPullRequest } from '@linker/api/openAPIDefinition.schemas';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import { PullRequestSheet } from './PullRequestSheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
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
});

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  resetOverlayHistory();
});

it('uses the generated B API and renders open/merged records with repository, number and author', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => ({
    items: [row(url.includes('state=merged') ? 'merged' : 'open')],
  }));
  renderWithProviders(<PullRequestSheet roomId={7} login="me" />, {
    searchParams: '?overlay=chat-pull-requests',
  });
  expect(await screen.findByText('실제 API 필드의 열린 PR')).toBeVisible();
  expect(screen.getByText('linker-test-org/server · #42 · D-Gyun103')).toBeVisible();
  expect(vi.mocked(apiFetch).mock.calls[0]![0]).toBe(
    '/api/v1/user/chat-rooms/7/pull-requests?state=open',
  );
  await userEvent.click(screen.getByRole('button', { name: '병합됨' }));
  expect(await screen.findByText('실제 API 필드의 병합 PR')).toBeVisible();
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
  expect(screen.queryByText('실제 API 필드의 열린 PR')).not.toBeInTheDocument();
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
