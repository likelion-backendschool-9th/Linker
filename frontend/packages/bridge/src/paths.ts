/** App authentication returns carry an authorization code, never a session token. */
export const AUTH_REDIRECT_URL = 'linker://auth';

/** Normalize an internal destination before it reaches a WebView or router. */
export function internalPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u0020]/.test(value))
    return null;
  try {
    const url = new URL(value, 'https://linker.invalid');
    return url.origin === 'https://linker.invalid'
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

/** Match the complete callback target; `linker://auth-other` is not our callback. */
export function authCallbackPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'linker:' ||
      url.hostname !== 'auth' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      (url.pathname !== '' && url.pathname !== '/')
    )
      return null;
    const params = new URLSearchParams();
    for (const key of ['code', 'state', 'error', 'returnTo']) {
      if (url.searchParams.getAll(key).length > 1) return null;
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (!params.has('state') || (!params.has('code') && !params.has('error'))) return null;
    return `/auth/callback?${params}`;
  } catch {
    return null;
  }
}
