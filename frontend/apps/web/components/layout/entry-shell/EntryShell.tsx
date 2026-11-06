import type { ReactNode } from 'react';

import styles from '../shell.module.css';

/** Group layout wrapper for (auth): start, callbacks, recruiter sign-up/login. No bottom tabs. */
export function EntryShell({ children }: { children: ReactNode }) {
  return <div className={styles.entry}>{children}</div>;
}
