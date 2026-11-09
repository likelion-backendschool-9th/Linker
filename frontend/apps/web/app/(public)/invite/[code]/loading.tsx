import { SkipLink } from '@/components/layout/skip-link/SkipLink';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './_components/invite-accept-area/InviteAcceptArea.module.css';

export default function Loading() {
  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className={styles.stage} aria-busy="true">
        <div className={styles.column}>
          <Skeleton variant="card" />
        </div>
      </main>
    </>
  );
}
