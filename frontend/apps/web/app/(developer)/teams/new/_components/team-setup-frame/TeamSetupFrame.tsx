import type { ReactNode } from 'react';
import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { TeamSetupProgress } from './TeamSetupProgress';
import styles from './TeamSetupFrame.module.css';

/** Page 08 uses the Figma back/title header above its five-step progress. */
export function TeamSetupFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <PageFrame title="팀 생성하기" variant="stack" backHref="/workspace" bottomTabs={false}>
        <TeamSetupProgress>{children}</TeamSetupProgress>
      </PageFrame>
    </div>
  );
}
