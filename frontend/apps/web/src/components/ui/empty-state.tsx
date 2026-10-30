import type { ReactNode } from 'react';

import styles from './state.module.css';

type EmptyStateProps = {
  /** What's missing, from 04 ch. 12 (e.g. "아직 볼 글이 없어요.") */
  title: string;
  /** What to do next */
  description?: string;
  action?: ReactNode;
};

/** Empty list or result. Copy says what's missing and what to do next (04 ch. 12). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
