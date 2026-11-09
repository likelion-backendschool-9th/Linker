import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { TeamSetupCompletion } from './TeamSetupCompletion';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const replace = vi.fn();
const completeUrl = '/api/v1/user/teams/77/setup/complete';
const permissionUrl = '/api/v1/user/teams/77/setup/permission-check';
const progress = { queued: true, state: 'QUEUED', failedStep: null };

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  replace.mockReset();
  resetOverlayHistory();
  vi.mocked(useRouter).mockReturnValue({
    bfcacheId: '',
    push: vi.fn(),
    replace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });
});

it('does not complete or show success from URL state alone, then replaces navigation with the confirmed team', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    url === permissionUrl
      ? {
          basePermission: 'WRITE',
          settingsUrl: 'https://github.com/organizations/test/settings/member_privileges',
        }
      : progress,
  );
  renderWithProviders(<TeamSetupCompletion teamId={77} />);
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: '팀을 생성 하셨습니다!' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('heading', { name: '팀을 생성 하셨습니다!' })).toBeVisible();
  expect(apiFetch).toHaveBeenNthCalledWith(
    1,
    permissionUrl,
    expect.objectContaining({ method: 'GET' }),
  );
  expect(apiFetch).toHaveBeenNthCalledWith(
    2,
    completeUrl,
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ retry: false }) }),
  );
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(replace).toHaveBeenCalledWith('/workspace?teamId=77');
});

it.each(['READ', 'NONE'])(
  'shows the shared permission sheet before sending completion for %s',
  async (basePermission) => {
    vi.mocked(apiFetch).mockResolvedValue({
      basePermission,
      settingsUrl: 'https://github.com/organizations/test/settings/member_privileges',
    });
    renderWithProviders(<TeamSetupCompletion teamId={77} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('dialog', { name: 'GitHub 권한 설정' })).toBeVisible();
    expect(
      screen.getByText('팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'GitHub 권한 설정 보기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  },
);

it.each([
  { queued: true, state: 'RUNNING', failedStep: null },
  { queued: false, state: 'COMPLETED', failedStep: null },
])(
  'accepts existing $state work without claiming the async sync just completed',
  async (result) => {
    vi.mocked(apiFetch).mockImplementation(async (url) =>
      url === permissionUrl ? { basePermission: 'ADMIN', settingsUrl: '' } : result,
    );
    renderWithProviders(<TeamSetupCompletion teamId={77} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('heading', { name: '팀을 생성 하셨습니다!' })).toBeVisible();
    expect(screen.queryByText('동기화 완료')).not.toBeInTheDocument();
  },
);

it.each(['FAILED', 'STALE'])(
  'keeps %s results out of the success view and enables only an explicit retry',
  async (state) => {
    let calls = 0;
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === permissionUrl) return { basePermission: 'WRITE', settingsUrl: '' };
      calls++;
      return calls === 1 ? { queued: false, state, failedStep: 'ISSUES' } : progress;
    });
    renderWithProviders(<TeamSetupCompletion teamId={77} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        state === 'FAILED' ? '동기화에 실패했어요' : '연결 정보를 다시 확인해 주세요',
      ),
    );
    expect(calls).toBe(1);
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('heading', { name: '팀을 생성 하셨습니다!' });
    const bodies = vi
      .mocked(apiFetch)
      .mock.calls.filter(([url]) => url === completeUrl)
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([{ retry: false }, { retry: state === 'FAILED' }]);
  },
);

it('does not complete after permission lookup fails', async () => {
  vi.mocked(apiFetch).mockRejectedValue(
    new ApiError(403, { code: 'TEAM_ROLE_REQUIRED', message: '팀 권한이 필요해요' }),
  );
  renderWithProviders(<TeamSetupCompletion teamId={77} />);
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('팀 권한이 필요해요'));
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
});

it('rejects an unaccepted queue result and makes no automatic second write', async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    url === permissionUrl
      ? { basePermission: 'WRITE', settingsUrl: '' }
      : { queued: false, state: 'QUEUED', failedStep: null },
  );
  renderWithProviders(<TeamSetupCompletion teamId={77} />);
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('연결 정보를 다시 확인해 주세요'),
  );
  expect(vi.mocked(apiFetch).mock.calls.filter(([url]) => url === completeUrl)).toHaveLength(1);
  expect(screen.queryByRole('heading', { name: '팀을 생성 하셨습니다!' })).not.toBeInTheDocument();
});

it('does not look up or submit a missing team', () => {
  renderWithProviders(<TeamSetupCompletion teamId={null} />);
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  expect(apiFetch).not.toHaveBeenCalled();
});
