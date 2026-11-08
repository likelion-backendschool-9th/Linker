import type { Route } from 'next';
import type { ReactNode } from 'react';

import { BackButton } from '../back-button';
import styles from '../header.module.css';

type StackHeaderProps = {
  /** The page's h1 on stack screens (blueprint §6-1) */
  title: string;
  /** Optional h1 content in place of the plain title, e.g. a team-switch button (11–15). Defaults to `title`. */
  titleContent?: ReactNode;
  backHref?: Route;
  actions?: ReactNode;
};

/** Top bar of stack screens: back, title (the page's h1), optional actions. */
export function StackHeader({ title, titleContent, backHref, actions }: StackHeaderProps) {
  return (
    <div className={styles.chrome}>
      <header className={styles.header}>
        <div className={styles.inner}>
          {backHref && <BackButton fallbackHref={backHref} />}
          <h1 id="page-title" className={styles.title}>
            {titleContent ?? title}
          </h1>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
    </div>
  );
}
