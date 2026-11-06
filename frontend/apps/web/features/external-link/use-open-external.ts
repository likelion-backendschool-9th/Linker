'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { isDomainConfirmed, openExternalNow, parseHttpsUrl } from './open-external';

/**
 * Opens an external https link: right away for a confirmed domain, otherwise through the
 * "외부 사이트로 이동합니다" sheet. Non-https links are ignored (04 ch. 2).
 */
export function useOpenExternal() {
  const sheet = useOverlay('external-link');
  return (url: string) => {
    const parsed = parseHttpsUrl(url);
    if (!parsed) return;
    if (isDomainConfirmed(parsed.hostname)) openExternalNow(parsed.href);
    else sheet.open(parsed.href);
  };
}
