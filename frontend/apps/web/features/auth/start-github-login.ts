import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, requestNative } from '@/lib/bridge/native';

/**
 * "GitHub로 시작" from anywhere (login sheet, 01 start screen).
 * `GET /api/v1/public/auth/github/authorize-url` belongs to AuthController (page 01); this hand-written call and
 * its response type are replaced by the orval p01 function once the controller is in OpenAPI.
 * In the app, the system browser does the login and comes back via `linker://auth` (blueprint §11-3).
 */
export async function startGithubLogin(returnTo: string) {
  const client = isInApp() ? 'app' : 'web';
  const query = new URLSearchParams({ client, returnTo });
  const { authorizeUrl } = await apiFetch<{ authorizeUrl: string }>(
    `/api/v1/public/auth/github/authorize-url?${query}`,
  );
  if (typeof authorizeUrl !== 'string' || !authorizeUrl.trim())
    throw new Error('invalid-authorize-url');
  const destination = new URL(authorizeUrl, window.location.origin);
  if (destination.username || destination.password) throw new Error('invalid-authorize-url');
  // Same-origin sign-in destinations keep the current cookie context. This also supports the
  // existing mock API response without making a page or component aware of mock mode.
  if (destination.origin === window.location.origin) {
    window.location.assign(destination.href);
    return;
  }
  if (destination.protocol !== 'https:') throw new Error('invalid-authorize-url');
  if (client === 'app') {
    const result = await requestNative(
      { type: 'AUTH_GITHUB_START', authorizeUrl: destination.href },
      { timeoutMs: 0 },
    );
    if (!result.ok) throw new Error(result.error);
  } else {
    window.location.assign(destination.href);
  }
}
