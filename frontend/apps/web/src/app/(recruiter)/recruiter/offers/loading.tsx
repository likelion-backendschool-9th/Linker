import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

import styles from './_components/recruiter-offers.module.css';

export default function RecruiterOffersLoading() {
  return (
    <PageFrame title="보낸 채용 제안" variant="tab">
      <LoadingIndicator
        className={styles.page}
        label="채용 제안 불러오는 중"
        labelHidden
        variant="block"
      >
        <Skeleton variant="line" count={2} />
        <Skeleton variant="card" count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
