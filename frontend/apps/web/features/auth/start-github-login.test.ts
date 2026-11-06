import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, requestNative } from '@/lib/bridge/native';

import { startGithubLogin } from './start-github-login';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/bridge/native', () => ({ isInApp: vi.fn(() => true), requestNative: vi.fn() }));

describe('GitHub login in the app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isInApp).mockReturnValue(true);
    vi.mocked(apiFetch).mockResolvedValue({
      authorizeUrl: 'https://github.com/login/oauth/authorize',
    });
  });

  it('waits for the system browser result instead of timing out a user login after five seconds', async () => {
    vi.mocked(requestNative).mockResolvedValue({ type: 'RESULT', id: 'auth', ok: true });
    await startGithubLogin('/workspace');
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/public/auth/github/authorize-url?client=app&returnTo=%2Fworkspace',
    );
    expect(requestNative).toHaveBeenCalledWith(
      { type: 'AUTH_GITHUB_START', authorizeUrl: 'https://github.com/login/oauth/authorize' },
      { timeoutMs: 0 },
    );
  });

  it('returns a cancelled login to the screen so its button can be retried', async () => {
    vi.mocked(requestNative).mockResolvedValue({
      type: 'RESULT',
      id: 'auth',
      ok: false,
      error: 'cancelled',
    });
    await expect(startGithubLogin('/feed')).rejects.toThrow('cancelled');
  });

  it.each([
    'http://external.test/authorize',
    'https://user:password@github.com/login',
    '',
    undefined,
  ])('rejects an unsafe external authorization URL: %s', async (authorizeUrl) => {
    vi.mocked(apiFetch).mockResolvedValue({ authorizeUrl });
    await expect(startGithubLogin('/feed')).rejects.toThrow('invalid-authorize-url');
    expect(requestNative).not.toHaveBeenCalled();
  });
});
