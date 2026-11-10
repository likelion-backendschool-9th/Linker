import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './_components/admin-audit-view/AdminAuditView.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <h1 id="page-title" className={styles.heading}>
        운영 로그
      </h1>
      <Skeleton variant="card" count={3} />
    </div>
  );
}
