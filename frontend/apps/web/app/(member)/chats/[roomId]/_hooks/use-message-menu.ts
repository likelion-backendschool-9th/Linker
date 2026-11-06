'use client';

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 500;
const MOVE_TOLERANCE = 10;

/** Long press leaves native scrolling intact; movement, scrolling and unmount cancel the hold. */
export function useMessageMenu(enabled: boolean, onOpen: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pointer.current = null;
  }
  useEffect(() => {
    const cancel = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      pointer.current = null;
    };
    const anotherPointer = (event: globalThis.PointerEvent) => {
      suppressClick.current = false;
      if (pointer.current && pointer.current.id !== event.pointerId) cancel();
    };
    // A delayed touch click may land on the newly opened sheet rather than the bubble.
    const ghostClick = (event: globalThis.MouseEvent) => {
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('click', ghostClick, true);
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('pointerdown', anotherPointer, true);
    return () => {
      cancel();
      window.removeEventListener('click', ghostClick, true);
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pointerdown', anotherPointer, true);
    };
  }, []);
  useEffect(() => {
    if (!enabled) {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      pointer.current = null;
    }
  }, [enabled]);
  return {
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      const held = pointer.current !== null;
      const alreadyOpened = suppressClick.current;
      cancel();
      if (held) suppressClick.current = true;
      if (!alreadyOpened) onOpen();
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      cancel();
      suppressClick.current = false;
      if (!enabled || event.isPrimary === false || event.button !== 0 || event.pointerType === 'mouse') return;
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        suppressClick.current = true;
        onOpen();
      }, HOLD_MS);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = pointer.current;
      if (start && (Math.abs(event.clientX - start.x) > MOVE_TOLERANCE || Math.abs(event.clientY - start.y) > MOVE_TOLERANCE)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!enabled || event.target !== event.currentTarget || event.repeat) return;
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cancel();
        onOpen();
      }
    },
  };
}
