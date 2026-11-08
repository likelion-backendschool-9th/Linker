'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export type BoardMenuItem = { value: string; label: string };

type Position = { top: number; left: number; width: number };

/**
 * Menu button (WAI-ARIA APG "menu button") for the board's small dropdowns. The menu is fixed under its
 * trigger so a column's horizontal scroller never clips it, and closes on outside press, scroll or resize.
 */
export function useBoardMenu({
  onSelect,
  blocked,
}: {
  onSelect: (value: string) => void;
  /** Set when the menu can't open (no write permission): pressing the trigger calls it instead */
  blocked?: () => void;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const open = position !== null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);

  function openMenu() {
    if (blocked) {
      blocked();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  }

  // Focus the checked item (or the first) once the menu is shown
  useEffect(() => {
    if (!open) return;
    const items = menuItems();
    const checked = items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0];
    checked?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (menuRef.current?.contains(target) || triggerRef.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!inside(event.target)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  function onTriggerClick() {
    if (open) close(false);
    else openMenu();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!open) openMenu();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const items = menuItems();
    const index = items.findIndex((item) => item === document.activeElement);
    const focusAt = (next: number) => items[(next + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  }

  function select(value: string) {
    close(true);
    onSelect(value);
  }

  return {
    open,
    position,
    triggerRef,
    menuRef,
    menuId,
    onTriggerClick,
    onTriggerKeyDown,
    onMenuKeyDown,
    select,
  };
}
