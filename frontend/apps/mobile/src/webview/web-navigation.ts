import { internalPath, type NativeToWeb } from '@linker/bridge';

type WebNavigationActions = {
  send: (msg: NativeToWeb) => void;
  replace: (path: string) => void;
};

function callbackKey(path: string): string {
  const url = new URL(path, 'https://linker.invalid');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // The browser handoff may add returnTo; it is still the same one-use authorization code.
  return url.pathname === '/auth/callback' && code && state ? JSON.stringify([code, state]) : path;
}

/** Keep arrivals until READY, and load a given OAuth callback only once across both Expo callbacks. */
export function createWebNavigation(actions: WebNavigationActions) {
  let ready = false;
  let heldAuthPath: string | null = null;
  // A delayed Linking event can replay an older callback after a newer login.
  const loadedCallbacks = new Set<string>();
  let heldPath: string | null = null;

  function loadPath(value: string) {
    const path = internalPath(value);
    if (!path) return;
    const key = callbackKey(path);
    if (loadedCallbacks.has(key)) return;
    if (!ready) {
      heldAuthPath = path;
      return;
    }
    loadedCallbacks.add(key);
    ready = false;
    actions.replace(path);
  }

  return {
    loadPath,
    openPath(value: string) {
      const path = internalPath(value);
      if (!path) return;
      if (ready) actions.send({ type: 'DEEP_LINK', path });
      else heldPath = path; // The latest notification tap is the intended destination.
    },
    onLoadStart(loading = true) {
      // Android also emits this event for SPA history updates, after the web is already ready.
      if (loading) ready = false;
    },
    onReady() {
      ready = true;
      if (heldAuthPath) {
        const path = heldAuthPath;
        heldAuthPath = null;
        loadPath(path);
        return;
      }
      if (heldPath) {
        actions.send({ type: 'DEEP_LINK', path: heldPath });
        heldPath = null;
      }
    },
  };
}
