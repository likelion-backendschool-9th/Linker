import { useEffect } from 'react';

/** On `<html>` while the page is scrolled off the top; read by `:global(html.tab-chrome-collapsed)` rules */
export const TAB_CHROME_COLLAPSED_CLASS = 'tab-chrome-collapsed';
const CHROME_SELECTOR = '[data-tab-chrome]';
/** Fields inside the chrome that must lose focus when it reopens (19 search panel's input): a
 * hidden field under `overflow: hidden` would otherwise keep focus while invisible. */
const BLUR_SELECTOR = '[data-tab-chrome-blur]';
/** Start offset for the pin slide; read by the pages' `tab-chrome-pin` keyframes. */
const PIN_FROM_VAR = '--tab-chrome-pin-from';

/**
 * 19 recruit list scenario 2, shared with 24 home feed: any scroll off the top collapses the
 * header and pins the page's tab chrome (`[data-tab-chrome]`) to the viewport top with a FLIP
 * slide; only `scrollY === 0` restores both with the CSS open animation. Toggles a plain class on
 * `<html>` — matching `:global(html.tab-chrome-collapsed)` rules in `header.module.css` and each
 * page's CSS — rather than React state, since the header lives outside the page tree (PageFrame).
 */
export function useTabChromeCollapse() {
  useEffect(() => {
    const root = document.documentElement;
    let collapsed = false;
    let ticking = false;

    const setCollapsed = (next: boolean) => {
      if (collapsed === next) return;

      const chrome = document.querySelector<HTMLElement>(CHROME_SELECTOR);
      if (next && chrome) {
        // FLIP: record where the chrome is now so the fixed pin can ease from there to top.
        const from = Math.max(0, Math.round(chrome.getBoundingClientRect().top));
        chrome.style.setProperty(PIN_FROM_VAR, `${from}px`);
      }

      collapsed = next;
      root.classList.toggle(TAB_CHROME_COLLAPSED_CLASS, next);

      if (!next) {
        chrome?.style.removeProperty(PIN_FROM_VAR);
        if (document.activeElement?.matches(BLUR_SELECTOR)) {
          (document.activeElement as HTMLElement).blur();
        }
      }
    };

    const syncFromScroll = () => {
      // Overscroll can report a negative Y on some engines; clamp so the top latch stays reliable.
      setCollapsed(Math.max(window.scrollY, 0) > 0);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        syncFromScroll();
        ticking = false;
      });
    };

    syncFromScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root.classList.remove(TAB_CHROME_COLLAPSED_CLASS);
      document.querySelector<HTMLElement>(CHROME_SELECTOR)?.style.removeProperty(PIN_FROM_VAR);
    };
  }, []);
}
