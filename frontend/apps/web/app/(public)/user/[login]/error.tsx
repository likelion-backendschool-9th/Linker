'use client';

import { Button } from '@/components/ui/button/Button';
import styles from './_components/profile.module.css';

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.errorState} aria-labelledby="profile-error-title">
      <h1 id="profile-error-title">프로필을 불러오지 못했어요</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
