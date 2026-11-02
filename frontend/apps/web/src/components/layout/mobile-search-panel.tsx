'use client';

import styles from './header.module.css';
import { HeaderSearch } from './header-search';
import { useMobileSearch } from './mobile-search-context';

/** The search input row that drops below the mobile header when the search icon is tapped open. */
export function MobileSearchPanel() {
  const { isOpen } = useMobileSearch();
  if (!isOpen) return null;

  return (
    <div id="mobile-search-panel" className={styles.mobileSearchPanel}>
      <HeaderSearch className={styles.searchMobile} />
    </div>
  );
}
