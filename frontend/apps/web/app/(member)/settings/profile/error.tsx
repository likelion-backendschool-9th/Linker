'use client';

import { Button } from '@/components/ui/button/Button';
import styles from './_components/profile-edit-form.module.css';

export default function ProfileEditError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.errorState} aria-labelledby="profile-edit-error-title">
      <h1 id="profile-edit-error-title">프로필 정보를 불러오지 못했어요</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
