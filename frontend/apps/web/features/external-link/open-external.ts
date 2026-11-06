import { safeStorage } from '@/lib/browser/safe-storage';
import { postToNative } from '@/lib/bridge/native';

/** Domains the viewer already confirmed once; the confirm sheet shows only the first time per domain (04 ch. 2 "Links"). */
const SEEN_KEY = 'linker:external-domains';

export function parseHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

export function isDomainConfirmed(hostname: string): boolean {
  return (safeStorage.get<string[]>(SEEN_KEY) ?? []).includes(hostname);
}

export function confirmDomain(hostname: string) {
  const seen = safeStorage.get<string[]>(SEEN_KEY) ?? [];
  if (!seen.includes(hostname)) safeStorage.set(SEEN_KEY, [...seen, hostname]);
}

/** App: system browser via the bridge. Browser: new tab. Call from a click handler. */
export function openExternalNow(url: string) {
  if (postToNative({ type: 'OPEN_EXTERNAL', url })) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
