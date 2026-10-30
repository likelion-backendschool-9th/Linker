import { NextResponse, type NextRequest } from 'next/server';

import { loginRedirectPath, PATHNAME_HEADER, SEARCH_HEADER } from '@/lib/auth/proxy-paths';
import { readViewerFromToken, SESSION_COOKIE } from '@/lib/auth/read-role';
import { resolveAccess } from '@/lib/auth/route-access';

/** Access guard on every page request, from verified JWT claims only (blueprint §4-3). */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const viewer = await readViewerFromToken(request.cookies.get(SESSION_COOKIE)?.value);

  switch (resolveAccess(pathname, viewer)) {
    case 'login':
      return NextResponse.redirect(new URL(loginRedirectPath(pathname + search), request.url));
    case 'home':
      return NextResponse.redirect(new URL('/feed', request.url));
    case 'onboarding':
      return NextResponse.redirect(new URL('/onboarding', request.url));
    case 'notFound':
      return NextResponse.rewrite(new URL('/404', request.url), { status: 404 });
    case 'allow': {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(PATHNAME_HEADER, pathname);
      requestHeaders.set(SEARCH_HEADER, search);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      if (pathname.startsWith('/admin')) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
  }
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|manifest\\.webmanifest|sitemap|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico)$).*)',
  ],
};
