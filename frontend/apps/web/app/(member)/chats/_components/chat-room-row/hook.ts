'use client';

import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** Touch hold before the row menu opens (iOS has no contextmenu event for a long press) */
const LONG_PRESS_MS = 500;

/**
 * Opens the row menu on right-click or the keyboard menu key (both fire `contextmenu`) and on a
 * touch long press. A long press that opened the menu swallows the click that follows, so lifting
 * the finger doesn't also navigate into the room. Without `onOpen` the row keeps native behavior.
 */
export function useRowMenuGesture(onOpen?: () => void) {
  const timer = useRef<number | null>(null);
  const opened = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clear, []);

  if (!onOpen) return {};
  return {
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      clear();
      onOpen();
    },
    onPointerDown: (event: PointerEvent) => {
      opened.current = false;
      if (event.pointerType === 'mouse') return;
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        opened.current = true;
        onOpen();
      }, LONG_PRESS_MS);
    },
    // A scroll starts with pointercancel, so the hold never fires mid-swipe.
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture: (event: MouseEvent) => {
      if (!opened.current) return;
      opened.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
