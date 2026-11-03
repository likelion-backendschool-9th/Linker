import { internalPath, type NativeToWeb } from '@linker/bridge';

type WebNavigationActions = {
  send: (msg: NativeToWeb) => void;
  replace: (path: string) => void;
};

/** Keep arrivals until READY, and load a given OAuth callback only once across both Expo callbacks. */
export function createWebNavigation(actions: WebNavigationActions) {
  let ready = false;
  let heldAuthPath: string | null = null;
  let lastAuthPath: string | null = null;
  let heldPath: string | null = null;

  function loadPath(value: string) {
    const path = internalPath(value);
    if (!path || path === lastAuthPath) return;
    if (!ready) {
      heldAuthPath = path;
      return;
    }
    lastAuthPath = path;
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
