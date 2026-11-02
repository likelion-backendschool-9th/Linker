import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

import styles from '../_components/admin-data.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <h1 id="page-title" className={styles.title}>
        운영 · 회원 관리
      </h1>
      <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
        <Skeleton variant="card" count={3} />
      </LoadingIndicator>
    </div>
  );
}
