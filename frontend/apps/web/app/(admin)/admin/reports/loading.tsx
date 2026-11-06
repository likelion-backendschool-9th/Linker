import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './_components/admin-reports.module.css';

export default function LoadingAdminReports() {
  return (
    <div className={styles.page} role="status" aria-label="신고 목록 불러오는 중">
      <Skeleton variant="line" count={3} />
      <Skeleton variant="card" count={4} />
    </div>
  );
}
