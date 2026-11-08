'use client';

import { CloseLinearIcon } from '@solar-icons/static/linear/close';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';

import { Icon } from '@/components/ui/icon';

import styles from '../header.module.css';
import { useMobileSearch } from '../mobile-search-context';

/** Swaps the mobile search icon for a close icon while the input row below it is open. */
export function MobileSearchToggle() {
  const { isOpen, toggle } = useMobileSearch();
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-expanded={isOpen}
      aria-controls="mobile-search-panel"
      onClick={toggle}
    >
      <Icon
        svg={isOpen ? CloseLinearIcon : MagnifierLinearIcon}
        className={isOpen ? undefined : styles.magnifierIcon}
      />
      <span className="sr-only">{isOpen ? '검색창 닫기' : '검색'}</span>
    </button>
  );
}
