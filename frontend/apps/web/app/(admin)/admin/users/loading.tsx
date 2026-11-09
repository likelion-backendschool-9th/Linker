import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from './_components/admin-users-view/AdminUsersView.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <h1 id="page-title">사용자 관리</h1>
      <Skeleton variant="card" count={3} />
    </div>
  );
}
