import 'server-only';

import type { Route } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { loginRedirectPath, PATHNAME_HEADER, SEARCH_HEADER } from './proxy-paths';
import { resolveAccess } from './route-access';
import { getSession, viewerFromSession, type Session } from './session';

/**
 * Group layouts re-check access against the real session (blueprint §4-1): `proxy.ts` only reads claims.
 * The path comes from the headers `proxy.ts` sets, since layouts don't receive it.
 */
export async function enforceAccess(): Promise<Session | null> {
  const session = await getSession();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get(PATHNAME_HEADER);
  if (!pathname) return session;

  switch (resolveAccess(pathname, viewerFromSession(session))) {
    case 'allow':
      return session;
    case 'login':
      redirect(loginRedirectPath(pathname + (requestHeaders.get(SEARCH_HEADER) ?? '')) as Route);
    case 'home':
      redirect('/feed');
    case 'onboarding':
      // Typed routes only know built pages; 02 adds /onboarding
      redirect('/onboarding' as Route);
    case 'notFound':
      notFound();
  }
}
