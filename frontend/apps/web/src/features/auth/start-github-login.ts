import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, postToNative } from '@/lib/bridge/native';

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
  if (client === 'app') {
    postToNative({ type: 'AUTH_GITHUB_START', id: crypto.randomUUID(), authorizeUrl });
  } else {
    window.location.assign(authorizeUrl);
  }
}
