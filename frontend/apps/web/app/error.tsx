'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { SkipLink } from '@/components/layout/skip-link/SkipLink';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';

import styles from './error.module.css';

/** Unexpected error inside a page, with retry (07 TODO 00). Sentry hooks in here later. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} aria-labelledby="page-title" className={styles.main}>
        <h1 id="page-title" className="sr-only">
          오류
        </h1>
        <ErrorState
          title="문제가 생겼어요"
          description="잠시 후 다시 시도해 주세요."
          onRetry={reset}
        />
        <div className={styles.home}>
          <Button asChild variant="soft">
            <Link href="/feed">홈으로 가기</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
