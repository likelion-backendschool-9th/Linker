import { useEffect } from 'react';

const COLLAPSED_CLASS = 'recruit-header-collapsed';
const CHROME_SELECTOR = '[data-recruit-chrome]';
/** RecruitSearchPanel's input; blurred when area B closes so a focused field doesn't stay focused
 * while hidden (`overflow: hidden` lets it keep focus, it just visually disappears). */
const SEARCH_INPUT_SELECTOR = '[data-recruit-search-input]';
/** Start offset for the pin slide; read by `RecruitList.module.css` keyframes. */
const PIN_FROM_VAR = '--recruit-chrome-pin-from';

/**
 * 19 recruit list scenario 2: any scroll off the top collapses the header and pins the tabs /
 * search chrome to the viewport top with a FLIP slide (see `RecruitList.module.css`); only
 * `scrollY === 0` restores both with the CSS open animation. Toggles a plain class on `<html>` —
 * matching `:global(.recruit-header-collapsed)` rules in `header.module.css`,
 * `RecruitList.module.css`, and `RecruitSearchPanel.module.css` — rather than React state, since
 * the header lives outside this component's tree (PageFrame).
 */
export function useRecruitHeaderCollapse() {
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
      root.classList.toggle(COLLAPSED_CLASS, next);

      if (!next) {
        chrome?.style.removeProperty(PIN_FROM_VAR);
        if (document.activeElement?.matches(SEARCH_INPUT_SELECTOR)) {
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
      root.classList.remove(COLLAPSED_CLASS);
      document.querySelector<HTMLElement>(CHROME_SELECTOR)?.style.removeProperty(PIN_FROM_VAR);
    };
  }, []);
}
