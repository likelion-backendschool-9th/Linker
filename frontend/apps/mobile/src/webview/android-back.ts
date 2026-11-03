const BACK_RESULT_TIMEOUT_MS = 300;
const EXIT_WINDOW_MS = 2000;

type BackActions = {
  askWeb: (id: string) => void;
  canGoBack: () => boolean;
  goBack: () => void;
  exit: () => void;
  notify: () => void;
};

/** Blueprint §12-3: close the overlay first, then web history, then double-back to exit. */
export function createAndroidBack(actions: BackActions) {
  let pending: { id: string; timer: ReturnType<typeof setTimeout> } | null = null;
  let lastPressAt: number | null = null;
  let sequence = 0;

  function fallback() {
    pending = null;
    if (actions.canGoBack()) {
      lastPressAt = null;
      actions.goBack();
      return;
    }
    const now = Date.now();
    if (lastPressAt !== null && now - lastPressAt < EXIT_WINDOW_MS) {
      lastPressAt = null;
      actions.exit();
      return;
    }
    lastPressAt = now;
    actions.notify();
  }

  return {
    press() {
      if (pending) return true;
      const id = `back-${++sequence}`;
      pending = { id, timer: setTimeout(fallback, BACK_RESULT_TIMEOUT_MS) };
      try {
        actions.askWeb(id);
      } catch {
        clearTimeout(pending?.timer);
        fallback();
      }
      return true;
    },
    onBackResult(id: string, handled: boolean) {
      if (pending?.id !== id) return;
      clearTimeout(pending.timer);
      if (handled) {
        pending = null;
        lastPressAt = null;
      } else fallback();
    },
    dispose() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
      lastPressAt = null;
    },
  };
}
