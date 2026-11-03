export const WEB_ORIGIN = new URL(process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000')
  .origin;

/** The scheme's GitHub login return (`linker://auth?code&state`, blueprint §11-3) */
export { AUTH_REDIRECT_URL } from '@linker/bridge';

export function isWebOrigin(url: string): boolean {
  try {
    const target = new URL(url);
    return target.origin === WEB_ORIGIN && !target.username && !target.password;
  } catch {
    return false;
  }
}
