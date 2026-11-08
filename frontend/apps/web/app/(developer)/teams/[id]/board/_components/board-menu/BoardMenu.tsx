'use client';

// client boundary: open state, keyboard and outside-press handling of the dropdown
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import type { ReactNode } from 'react';

import styles from './BoardMenu.module.css';
import { useBoardMenu, type BoardMenuItem } from './hook';

type BoardMenuProps = {
  /** Accessible name of the menu, e.g. "정렬" */
  label: string;
  items: BoardMenuItem[];
  /** Checked item; null = none */
  value: string | null;
  onSelect: (value: string) => void;
  /**
   * `control`: "필터"/"최신순" button + 111px menu (Figma 368:3414, 368:3562).
   * `status`: the card's status field + a menu as wide as the field (Figma 368:3741).
   */
  appearance: 'control' | 'status';
  /** `control`: blue like an open menu while a value is set (Figma 368:3741 "필터") */
  active?: boolean;
  /** See `useBoardMenu` */
  blocked?: () => void;
  /** Accessible name of the trigger; starts with its visible text's words (label in name) */
  triggerLabel: string;
  /** Trigger content before the chevron */
  children: ReactNode;
};

/** Dropdown of Figma 14 (368:3414, 368:3562, 368:3741), opened under its trigger */
export function BoardMenu({
  label,
  items,
  value,
  onSelect,
  appearance,
  active = false,
  blocked,
  triggerLabel,
  children,
}: BoardMenuProps) {
  const {
    open,
    position,
    triggerRef,
    menuRef,
    menuId,
    onTriggerClick,
    onTriggerKeyDown,
    onMenuKeyDown,
    select,
  } = useBoardMenu({ onSelect, blocked });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={appearance === 'control' ? styles.control : styles.status}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-disabled={blocked ? true : undefined}
        data-active={appearance === 'control' && (active || open)}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        {children}
        {/* Figma solar:alt-arrow (package SVG string) */}
        <span
          aria-hidden
          className={styles.chevron}
          dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }}
        />
      </button>
      {position && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={appearance === 'control' ? styles.controlMenu : styles.statusMenu}
          style={{
            top: position.top,
            left: position.left,
            width: appearance === 'status' ? position.width : undefined,
          }}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <li key={item.value} role="none" className={styles.row}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={item.value === value}
                tabIndex={-1}
                className={styles.item}
                onClick={() => select(item.value)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
