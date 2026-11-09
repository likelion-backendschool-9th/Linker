import { StrictMode } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import { ApiError } from '@/lib/api/api-error';
import { TeamInstallVerification } from './TeamInstallVerification';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const replace = vi.fn();
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  replace.mockReset();
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams('installation_id=777&state=issued&setup_action=install') as ReturnType<
      typeof useSearchParams
    >,
  );
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    bfcacheId: 'team-install-test',
  });
});

it('deduplicates verification across strict mounts and navigates only after an installed API result', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    result: 'INSTALLED',
    installationId: '777',
    org: { id: 501, login: 'my-new-org' },
    teamId: null,
  });
  renderWithProviders(
    <StrictMode>
      <TeamInstallVerification />
    </StrictMode>,
  );
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/teams/new?step=2'));
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/team-setup/installations/verify',
    expect.objectContaining({
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({ state: 'issued', installationId: '777', setupAction: 'install' }),
    }),
  );
});

it('does not retry a consumed or invalid state and never redirects to team information', async () => {
  vi.mocked(apiFetch).mockRejectedValue(
    new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: '설치 요청이 만료됐거나 올바르지 않아요.',
    }),
  );
  renderWithProviders(
    <StrictMode>
      <TeamInstallVerification />
    </StrictMode>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('GitHub에 연결하지 못했어요.');
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
});

it('keeps owner approval requests out of the installed form', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    result: 'REQUESTED_FROM_OWNER',
    installationId: null,
    org: null,
    teamId: null,
  });
  renderWithProviders(<TeamInstallVerification />);
  expect(
    await screen.findByRole('heading', { name: '오너에게 설치 요청을 보냈어요' }),
  ).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});
