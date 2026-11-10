'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * How many tech chips fit on one line. Measures a hidden copy of every chip (and of the "+N" chip
 * for each possible N) so the visible row never wraps: when all chips don't fit, the last ones give
 * way to "+N". Re-measures when the row is resized.
 */
export function useFittingChips(count: number) {
  const rowRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [visible, setVisible] = useState(count);

  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const fit = () => {
      const available = row.clientWidth;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const chips = [...measure.querySelectorAll<HTMLElement>('[data-chip]')].map(
        (el) => el.offsetWidth,
      );
      const more = (hidden: number) =>
        measure.querySelector<HTMLElement>(`[data-more="${hidden}"]`)?.offsetWidth ?? 0;

      const total = chips.reduce((sum, width, i) => sum + width + (i > 0 ? gap : 0), 0);
      if (total <= available) {
        setVisible(chips.length);
        return;
      }
      let used = 0;
      let shown = 0;
      for (const [i, width] of chips.entries()) {
        const next = used + (i > 0 ? gap : 0) + width;
        const hidden = chips.length - (i + 1);
        if (next + gap + more(hidden) > available) break;
        used = next;
        shown = i + 1;
      }
      setVisible(shown);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    return () => observer.disconnect();
  }, [count]);

  return { rowRef, measureRef, visible };
}
