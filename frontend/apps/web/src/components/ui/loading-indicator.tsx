import type { ReactNode } from 'react';

import { LoadingOrb } from './loading-orb';
import styles from './loading-indicator.module.css';

type LoadingIndicatorProps = {
  label: string;
  children?: ReactNode;
  variant?: 'block' | 'inline';
  tone?: 'inherit' | 'inverse' | 'danger';
  /** Keep the footprint of a placeholder that previously had no visible status row. */
  labelHidden?: boolean;
  /** The containing region already announces its changes. */
  announce?: boolean;
  className?: string;
  labelClassName?: string;
};

/** Server-safe shared loading UI. Placeholders keep their dimensions; only the orb is client-side. */
export function LoadingIndicator({
  label,
  children,
  variant = 'inline',
  tone = 'inherit',
  labelHidden = false,
  announce = true,
  className,
  labelClassName,
}: LoadingIndicatorProps) {
  const role = announce ? 'status' : undefined;
  const labelClasses =
    [labelHidden && 'sr-only', labelClassName].filter(Boolean).join(' ') || undefined;

  if (children !== undefined) {
    return (
      <div
        className={[styles.region, className].filter(Boolean).join(' ')}
        data-loading-state="placeholder"
      >
        <p role={role} className={labelClasses}>
          {label}
        </p>
        {children}
        <span className={styles.overlay} aria-hidden="true">
          <LoadingOrb variant={variant} tone={tone} />
        </span>
      </div>
    );
  }

  return (
    <span
      role={role}
      className={[styles.indicator, className].filter(Boolean).join(' ')}
      data-loading-state="inline"
    >
      <LoadingOrb variant={variant} tone={tone} />
      <span className={labelClasses}>{label}</span>
    </span>
  );
}
