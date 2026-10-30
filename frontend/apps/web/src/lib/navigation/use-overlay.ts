'use client';

import { useRouter } from 'next/navigation';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import type { Route } from 'next';

import { OVERLAY_KEYS, type OverlayKey } from './overlay-keys';

/**
 * Open/close for every overlay through one URL param, so back never traps (blueprint ch. 7).
 * Push only on first open, replace when switching, and close with `history.back()` only when we pushed.
 */

const parsers = {
  overlay: parseAsStringLiteral(OVERLAY_KEYS),
  oid: parseAsString,
  // Only the login sheet uses it; cleared with the overlay
  returnTo: parseAsString,
};

const CLOSED = { overlay: null, oid: null, returnTo: null };

let pushedByApp = false;

/** `OverlayRoot` calls this when the URL has no overlay (browser, Android or bridge back). */
export function resetOverlayHistory() {
  pushedByApp = false;
}

/** Any open overlay, for back handling outside a specific overlay (Android hardware back). */
export function useActiveOverlay() {
  const [{ overlay }, set] = useQueryStates(parsers, { shallow: true });

  function close() {
    if (!overlay) return;
    if (pushedByApp) {
      pushedByApp = false;
      window.history.back();
    } else {
      void set(CLOSED, { history: 'replace' });
    }
  }

  return { overlay, close };
}

export type OverlayControl = ReturnType<typeof useOverlay>;

export function useOverlay(key: OverlayKey) {
  const router = useRouter();
  const [{ overlay, oid, returnTo }, set] = useQueryStates(parsers, { shallow: true });
  const isOpen = overlay === key;

  function open(id?: string, options: { returnTo?: string } = {}) {
    if (isOpen && (id ?? null) === oid) return;
    const history = overlay ? 'replace' : 'push';
    if (history === 'push') pushedByApp = true;
    void set({ overlay: key, oid: id ?? null, returnTo: options.returnTo ?? null }, { history });
  }

  function close() {
    if (!isOpen) return;
    if (pushedByApp) {
      pushedByApp = false;
      window.history.back();
    } else {
      void set(CLOSED, { history: 'replace' });
    }
  }

  /** Leave the page from inside the overlay: close first, then navigate (blueprint §7-2 rule 4). */
  async function closeThen(href: Route) {
    if (!isOpen) {
      router.push(href);
      return;
    }
    if (pushedByApp) {
      pushedByApp = false;
      await new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
        window.history.back();
      });
    } else {
      await set(CLOSED, { history: 'replace' });
    }
    router.push(href);
  }

  return {
    isOpen,
    id: isOpen ? oid : null,
    returnTo: isOpen ? returnTo : null,
    open,
    close,
    closeThen,
    onOpenChange: (next: boolean) => (next ? open() : close()),
  };
}
