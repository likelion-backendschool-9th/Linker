import { safeReturnTo } from '@/lib/auth/return-to';

const DEFAULT_RETURN = '/feed';

/** Keeps a same-origin return path on payment callback URLs. `/feed` stays the default. */
export function withPaymentReturnTo(path: string, returnTo?: string | null): string {
  const destination = safeReturnTo(returnTo);
  if (destination === DEFAULT_RETURN) return path;
  const url = new URL(path, 'http://linker.local');
  url.searchParams.set('returnTo', destination);
  return `${url.pathname}${url.search}`;
}

export function paymentCallbackUrl(
  kind: 'success' | 'fail',
  origin: string,
  returnTo?: string | null,
): string {
  return new URL(withPaymentReturnTo(`/subscribe/${kind}`, returnTo), origin).toString();
}
