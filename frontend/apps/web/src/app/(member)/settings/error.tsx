'use client';

import { Button } from '@/components/ui/button';

import styles from './_views/settings-view.module.css';

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.content} aria-labelledby="settings-error-title">
      <section className={styles.section}>
        <h1 id="settings-error-title">설정을 불러오지 못했어요</h1>
        <p className={styles.description}>잠시 후 다시 시도해 주세요.</p>
        <Button onClick={reset}>다시 시도</Button>
      </section>
    </main>
  );
}
