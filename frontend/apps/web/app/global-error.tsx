'use client';

import '@/styles/globals.css';

import { ErrorState } from '@/components/ui/error-state/ErrorState';

/** The root layout itself failed; renders its own html/body. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main id="main" aria-labelledby="page-title">
          <h1 id="page-title" className="sr-only">
            오류
          </h1>
          <ErrorState
            title="문제가 생겼어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
