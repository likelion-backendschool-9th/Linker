'use client';

// Client boundary: URL-driven progress underneath the shared page header.
import { parseAsInteger, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { resolveSetupStep, STEPS } from '../../_lib/setup-steps';
import styles from './TeamSetupFrame.module.css';

export function TeamSetupProgress({ children }: { children: ReactNode }) {
  const [value] = useQueryState('step', parseAsInteger.withDefault(1));
  const step = resolveSetupStep(value);
  return (
    <>
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
      <div className={step <= 3 ? styles.content : styles.legacy}>{children}</div>
    </>
  );
}
