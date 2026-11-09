import type { ReactNode } from 'react';
import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { TeamSetupProgress } from './TeamSetupProgress';
import styles from './TeamSetupFrame.module.css';

/** Same tab header as page 07; setup retains its own progress and bottom action. */
export function TeamSetupFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <PageFrame title="팀 생성하기" hideTitle bottomTabs={false}>
        <TeamSetupProgress>{children}</TeamSetupProgress>
      </PageFrame>
    </div>
  );
}
