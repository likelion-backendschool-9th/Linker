'use client';

import { useMemo } from 'react';

import { safeStorage } from '@/lib/browser/safe-storage';
import { DRAFT } from '@/lib/policy';

type StoredDraft<T> = { value: T; savedAt: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Device draft for writing screens: saved on send failure (or while typing), kept 7 days
 * (04 ch. 2 "Network and failures"). `key` should name the screen and target, e.g. `draft:comment:post-12`.
 */
export function useDraft<T>(key: string) {
  return useMemo(
    () => ({
      /** The saved value, or null when there is none or it expired */
      load(): T | null {
        const stored = safeStorage.get<StoredDraft<T>>(key);
        if (!stored) return null;
        if (Date.now() - stored.savedAt > DRAFT.keepDays * DAY_MS) {
          safeStorage.remove(key);
          return null;
        }
        return stored.value;
      },
      save(value: T) {
        safeStorage.set(key, { value, savedAt: Date.now() } satisfies StoredDraft<T>);
      },
      clear() {
        safeStorage.remove(key);
      },
    }),
    [key],
  );
}
