'use client';

import { useEffect, useState, type ReactNode } from 'react';

import styles from './header.module.css';

/** Past this scrollY, the top bar animates into the floating "scroll header" (04 frontend task 2). */
const SCROLL_THRESHOLD = 8;

/** Wraps TabHeader's content so it can switch to the scrolled look without making the whole header a Client Component. */
export function HeaderScrollFrame({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={`${styles.inner} ${scrolled ? styles.innerScrolled : ''}`}>{children}</div>
    </header>
  );
}
