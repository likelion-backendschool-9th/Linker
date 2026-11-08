'use client';

// Navigation boundary: the existing URL step and app-aware back behavior.
import Image from 'next/image';
import { parseAsInteger, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';

import { SkipLink } from '@/components/layout/skip-link';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';
import { useAppBack } from '@/lib/navigation/use-app-back';

import { resolveSetupStep, STEPS } from '../../_lib/setup-steps';
import styles from './TeamSetupFrame.module.css';

/** Figma 8 (142:73): a 54px stack header and a five-part, 4px progress rail. */
export function TeamSetupFrame({ children }: { children: ReactNode }) {
  const back = useAppBack('/workspace');
  const [value] = useQueryState('step', parseAsInteger.withDefault(1));
  const step = resolveSetupStep(value);
  return (
    <div className={styles.frame}>
      <SkipLink />
      <div className={styles.chrome}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={back}>
            <Image src="/images/team-setup/back.svg" alt="" width={44} height={44} />
            <span className="sr-only">뒤로</span>
          </button>
          <h1 id="page-title" className={styles.title}>
            팀 생성하기
          </h1>
        </header>
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
        className={step === 1 ? styles.main : styles.legacy}
      >
        <StatusBanners />
        {children}
      </main>
    </div>
  );
}
