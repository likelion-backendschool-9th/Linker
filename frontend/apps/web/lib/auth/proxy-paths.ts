/** Request headers `proxy.ts` adds so server layouts know the path (layouts don't get it as a prop). */
export const PATHNAME_HEADER = 'x-linker-pathname';
export const SEARCH_HEADER = 'x-linker-search';

/** Guests on a login-only URL see the login-prompt sheet over the feed, then return (blueprint §4-3). */
export function loginRedirectPath(returnTo: string): string {
  return `/feed?overlay=login&returnTo=${encodeURIComponent(returnTo)}`;
}
