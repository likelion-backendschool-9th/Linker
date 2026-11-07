import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './_components/recruiter-offers.module.css';

export default function RecruiterOffersLoading() {
  return (
    <PageFrame title="보낸 제안" variant="stack" backHref="/feed" bottomTabs={false}>
      <div className={styles.page} aria-label="채용 제안 불러오는 중" aria-busy="true">
        <Skeleton variant="line" count={2} />
        <Skeleton variant="card" count={3} />
      </div>
    </PageFrame>
  );
}
