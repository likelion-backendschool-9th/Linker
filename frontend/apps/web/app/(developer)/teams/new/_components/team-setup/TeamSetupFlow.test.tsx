import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useEffect } from 'react';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import { verifiedInstallationKey } from '../../_lib/installation';
import { TeamSetup } from './TeamSetup';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const installed = {
  result: 'INSTALLED',
  org: { id: 501, login: 'my-new-org' },
  installationId: '777',
  teamId: null,
} as const;

function SetupFlow() {
  const client = useQueryClient();
  const [, setStep] = useQueryState('step', parseAsInteger);
  useEffect(() => {
    client.setQueryData(verifiedInstallationKey(null), installed);
  }, [client]);
  return (
    <>
      <TeamSetup />
      <button onClick={() => void setStep(2)}>팀 정보로 이동</button>
    </>
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

function respond(failCreate = false) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    if (url === '/api/v1/user/me/teams')
      return { items: [], teamCount: 0, teamLimit: 10, nextCursor: null };
    if (url === '/api/v1/user/teams' && init?.method === 'POST') {
      if (failCreate)
        throw new ApiError(503, {
          code: 'SERVICE_UNAVAILABLE',
          message: '잠시 후 다시 시도해 주세요',
        });
      return { id: 77, name: 'my-new-org', chatRoomId: 88 };
    }
    if (url === '/api/v1/user/teams/77/setup/repos')
      return {
        items: [{ id: 901, name: 'backend', fullName: 'my-new-org/backend', private: false }],
        notInstalledCount: null,
        settingsUrl: 'https://github.com/organizations/my-new-org/settings/installations/777',
      };
    if (url === '/api/v1/user/teams/77' && init?.method === 'PATCH') return undefined;
    throw new Error(`Unexpected setup request: ${url}`);
  });
}

it('creates from verified installation data, then reuses that team and the existing PATCH contract after editing', async () => {
  respond();
  renderWithProviders(<SetupFlow />, { searchParams: 'step=2' });
  await waitFor(() =>
    expect(screen.getByLabelText('팀 이름', { exact: true })).toHaveValue('my-new-org'),
  );
  fireEvent.change(screen.getByLabelText('팀 소개', { exact: true }), {
    target: { value: '함께 만들어요' },
  });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(await screen.findByRole('checkbox', { name: 'backend' })).toBeVisible();
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        installationId: '777',
        name: 'my-new-org',
        description: '함께 만들어요',
      }),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '팀 정보로 이동' }));
  fireEvent.change(await screen.findByLabelText('팀 이름', { exact: true }), {
    target: { value: '수정한 팀' },
  });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('checkbox', { name: 'backend' });
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/77',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: '수정한 팀', description: '함께 만들어요' }),
    }),
  );
  expect(
    vi
      .mocked(apiFetch)
      .mock.calls.filter(([url, init]) => url === '/api/v1/user/teams' && init?.method === 'POST'),
  ).toHaveLength(1);
});

it('retains the information step and input values after a creation failure', async () => {
  respond(true);
  renderWithProviders(<SetupFlow />, { searchParams: 'step=2' });
  await waitFor(() =>
    expect(screen.getByLabelText('팀 이름', { exact: true })).toHaveValue('my-new-org'),
  );
  fireEvent.change(screen.getByLabelText('팀 소개', { exact: true }), {
    target: { value: '다시 시도할 소개' },
  });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요');
  expect(screen.getByLabelText('팀 소개', { exact: true })).toHaveValue('다시 시도할 소개');
  expect(
    screen.queryByRole('heading', { name: '팀과 함께 할 저장소를 선택하세요' }),
  ).not.toBeInTheDocument();
});
