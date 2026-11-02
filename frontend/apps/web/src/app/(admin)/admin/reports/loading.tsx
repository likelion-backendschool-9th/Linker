import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

import styles from './_components/admin-reports.module.css';

export default function LoadingAdminReports() {
  return (
    <LoadingIndicator
      className={styles.page}
      label="신고 목록 불러오는 중"
      labelHidden
      variant="block"
    >
      <Skeleton variant="line" count={3} />
      <Skeleton variant="card" count={4} />
    </LoadingIndicator>
  );
}
