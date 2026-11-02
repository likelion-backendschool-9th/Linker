export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000';

/** The scheme's GitHub login return (`linker://auth?code&state`, blueprint §11-3) */
export const AUTH_REDIRECT_URL = 'linker://auth';

export function isWebOrigin(url: string): boolean {
  return url === WEB_ORIGIN || url.startsWith(`${WEB_ORIGIN}/`);
}
