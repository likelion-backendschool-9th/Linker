import { NextResponse, type NextRequest } from 'next/server';

import { MOCK_ROLE_COOKIE, parseMockRole } from '@/lib/auth/mock-viewer';
import { safeReturnTo } from '@/lib/auth/return-to';
import { USE_MOCKS } from '@/lib/mock-mode';

/**
 * Mock mode only (blueprint §1-2): sets the mock role cookie and goes to `returnTo`.
 * `/api/mock/login/developer?returnTo=/workspace`, `/api/mock/login/guest` logs out.
 * The cookie is readable by JS on purpose: browser-side mock fetch needs the role too.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/mock/login/[role]'>) {
  if (!USE_MOCKS) return new NextResponse(null, { status: 404 });

  const { role: value } = await ctx.params;
  const role = parseMockRole(value);
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  // A newcomer lands in onboarding no matter where they were going
  const target = role === 'newcomer' ? '/onboarding' : returnTo;

  const response = NextResponse.redirect(new URL(target, request.url));
  if (role === 'guest') response.cookies.delete(MOCK_ROLE_COOKIE);
  else response.cookies.set(MOCK_ROLE_COOKIE, role, { path: '/', sameSite: 'lax' });
  return response;
}
