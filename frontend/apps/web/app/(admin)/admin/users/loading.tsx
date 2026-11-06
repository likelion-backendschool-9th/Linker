import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../_components/admin-data.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <h1 id="page-title" className={styles.title}>
        운영 · 회원 관리
      </h1>
      <Skeleton variant="card" count={3} />
    </div>
  );
}
