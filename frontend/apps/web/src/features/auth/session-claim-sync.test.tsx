import { act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';

import { SessionClaimSync } from './session-claim-sync';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const developer = {
  role: 'developer' as const,
  login: 'seojun-han',
  status: 'ACTIVE' as const,
  suspendedUntil: null,
};

describe('SessionClaimSync', () => {
  const refresh = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(useRouter).mockReturnValue({
      bfcacheId: 'test',
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh,
      prefetch: vi.fn(),
    });
  });

  it('does not read /me for a guest', () => {
    renderWithProviders(<SessionClaimSync />);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('reloads the session when /me shows a new operator', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      userType: 'DEVELOPER',
      isAdmin: true,
      status: 'ACTIVE',
      suspendedUntil: null,
    });
    renderWithProviders(<SessionClaimSync />, { viewer: developer });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/me');
  });

  it('leaves the cache when /me still matches the layout', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      userType: 'DEVELOPER',
      isAdmin: false,
      status: 'ACTIVE',
      suspendedUntil: null,
    });
    renderWithProviders(<SessionClaimSync />, { viewer: developer });
    await act(async () => {
      await vi.mocked(apiFetch).mock.results[0]?.value;
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/me');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reloads when the cookie is no longer a session', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(401, { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' }),
    );
    renderWithProviders(<SessionClaimSync />, { viewer: developer });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
