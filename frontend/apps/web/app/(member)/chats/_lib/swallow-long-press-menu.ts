/** How long after the finger lifts the browser's own long-press menu may still arrive */
const AFTER_RELEASE_MS = 500;
/** Upper bound even if the release never reaches the window */
const MAX_MS = 5000;

/**
 * Call when a touch long press has just opened our own menu (16 row menu, 17 message menu).
 * The browser runs its own long-press gesture too, and its `contextmenu` (link menu on Android
 * Chrome and in DevTools device mode) lands on whatever is under the finger by then — our new
 * sheet, not the row — so the row's handler can't cancel it. Swallow it once, window-wide, until
 * shortly after the finger lifts.
 */
export function swallowLongPressMenu() {
  const prevent = (event: Event) => {
    event.preventDefault();
    stop();
  };
  const released = () => {
    window.removeEventListener('pointerup', released, true);
    window.removeEventListener('pointercancel', released, true);
    window.setTimeout(stop, AFTER_RELEASE_MS);
  };
  const cap = window.setTimeout(stop, MAX_MS);
  function stop() {
    window.clearTimeout(cap);
    window.removeEventListener('contextmenu', prevent, true);
    window.removeEventListener('pointerup', released, true);
    window.removeEventListener('pointercancel', released, true);
  }
  window.addEventListener('contextmenu', prevent, true);
  window.addEventListener('pointerup', released, true);
  window.addEventListener('pointercancel', released, true);
}
