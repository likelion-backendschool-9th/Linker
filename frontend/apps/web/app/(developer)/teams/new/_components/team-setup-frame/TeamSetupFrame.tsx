'use client';

// URL-step boundary: keep the progress rail sticky with the shared stack header.
import { parseAsInteger, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';

import { SkipLink } from '@/components/layout/skip-link';
import { StackHeader } from '@/components/layout/stack-header';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';

import { resolveSetupStep, STEPS } from '../../_lib/setup-steps';
import styles from './TeamSetupFrame.module.css';

/** Shared stack header; only the five-part progress rail belongs to page 08. */
export function TeamSetupFrame({ children }: { children: ReactNode }) {
  const [value] = useQueryState('step', parseAsInteger.withDefault(1));
  const step = resolveSetupStep(value);
  return (
    <div className={styles.frame}>
      <SkipLink />
      <div className={styles.chrome}>
        <StackHeader title="팀 생성하기" backHref="/workspace" />
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="팀 생성 단계"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step}
          aria-valuetext={`${step}/${STEPS.length}`}
        >
          {STEPS.map((label, index) => (
            <span key={label} className={index < step ? styles.current : undefined} />
          ))}
        </div>
      </div>
      <main
        id="main"
        tabIndex={-1}
        aria-labelledby="page-title"
        className={step <= 2 ? styles.main : styles.legacy}
      >
        <StatusBanners />
        {children}
      </main>
    </div>
  );
}
