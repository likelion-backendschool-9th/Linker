/**
 * Web Storage behind the SSR guard + try/catch (private mode, WebView limits; blueprint §11-1).
 * Values are JSON. Every method is a no-op on the server or when storage throws.
 */
function createSafeStorage(pick: () => Storage) {
  function storage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
      return pick();
    } catch {
      return null;
    }
  }

  return {
    get<T>(key: string): T | null {
      try {
        const raw = storage()?.getItem(key);
        return raw == null ? null : (JSON.parse(raw) as T);
      } catch {
        return null;
      }
    },
    set(key: string, value: unknown): void {
      try {
        storage()?.setItem(key, JSON.stringify(value));
      } catch {
        // quota exceeded or storage disabled: drop silently
      }
    },
    remove(key: string): void {
      try {
        storage()?.removeItem(key);
      } catch {
        // storage disabled
      }
    },
  };
}

export const safeStorage = createSafeStorage(() => window.localStorage);
export const safeSessionStorage = createSafeStorage(() => window.sessionStorage);
