import type { ReactNode } from 'react';

import styles from '../shell.module.css';

/** Group layout wrapper for app screens: (public), (member), (developer), (recruiter). Pages add `PageFrame`. */
export function AppShell({ children }: { children: ReactNode }) {
  return <div className={styles.app}>{children}</div>;
}
