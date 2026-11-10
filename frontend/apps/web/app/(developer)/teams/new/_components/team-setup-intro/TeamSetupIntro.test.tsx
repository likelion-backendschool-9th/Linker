import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { TeamSetup } from '../team-setup/TeamSetup';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const push = vi.fn();
const callback = {
  installUrl: '/teams/new/callback?installation_id=777&state=issued-state',
  state: 'issued-state',
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  push.mockReset();
  vi.mocked(useRouter).mockReturnValue({
    push,
    bfcacheId: 'team-setup-test',
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });
});

function respond(teamCount = 1) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) =>
    url === '/api/v1/user/me/teams'
      ? { items: [], teamCount, teamLimit: 10, nextCursor: null }
      : callback,
  );
}

it('shows only the Figma intro while installation remains unverified', async () => {
  respond();
  renderWithProviders(<TeamSetup />);
  expect(
    screen.getByRole('heading', { name: 'GitHub 조직을 연동하고 팀을 만드세요' }),
  ).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'GitHub로 시작하기' })).toBeEnabled(),
  );
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'GitHub 조직 생성하기' })).toHaveAttribute(
    'href',
    'https://github.com/organizations/plan',
  );
  expect(screen.queryByText('화면 미리보기예요.', { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '팀 만들기' })).not.toBeInTheDocument();
  expect(vi.mocked(apiFetch).mock.calls.map(([url]) => url)).toEqual(['/api/v1/user/me/teams']);
});

it('uses the server membership count even when the visible team array is empty', async () => {
  respond(10);
  renderWithProviders(<TeamSetup />);
  await screen.findByText('팀은 10개까지 참여할 수 있어요. 보관된 팀은 제외해요.');
  expect(screen.getByRole('button', { name: 'GitHub로 시작하기' })).toBeDisabled();
});

it('requests a fresh server URL on click and never treats that as a verified installation', async () => {
  respond();
  renderWithProviders(<TeamSetup />);
  const button = screen.getByRole('button', { name: 'GitHub로 시작하기' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith('/teams/new/callback?installation_id=777&state=issued-state'),
  );
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/team-setup/install-url',
    expect.objectContaining({ cache: 'no-store', method: 'GET' }),
  );
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(
    vi
      .mocked(apiFetch)
      .mock.calls.some(([url]) => url === '/api/v1/user/team-setup/installations/verify'),
  ).toBe(false);
});
