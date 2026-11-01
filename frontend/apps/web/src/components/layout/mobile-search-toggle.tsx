'use client';

import { CloseIcon } from '@solar-icons/react/linear/close';
import { MagnifierIcon } from '@solar-icons/react/linear/magnifier';

import styles from './header.module.css';
import { useMobileSearch } from './mobile-search-context';

/** Swaps the mobile search icon for a close icon while the input row below it is open. */
export function MobileSearchToggle() {
  const { isOpen, toggle } = useMobileSearch();
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${styles.mobileOnly}`}
      aria-expanded={isOpen}
      aria-controls="mobile-search-panel"
      onClick={toggle}
    >
      {isOpen ? <CloseIcon aria-hidden /> : <MagnifierIcon aria-hidden />}
      <span className="sr-only">{isOpen ? '검색창 닫기' : '검색'}</span>
    </button>
  );
}
