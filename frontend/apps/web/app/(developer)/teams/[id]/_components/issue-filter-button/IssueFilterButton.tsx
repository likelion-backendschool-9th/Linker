'use client';

import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button/Button';

import styles from './IssueFilterButton.module.css';
import { useIssueFilterButton } from './hook';

/**
 * "필터" button with the number of active filters (11, 14, 15).
 * `icon`: the header icon of Figma 11 (`lucide/sliders-horizontal`); the name and count are read out.
 */
export function IssueFilterButton({ appearance = 'button' }: { appearance?: 'button' | 'icon' }) {
  const { count, openFilter } = useIssueFilterButton();
  if (appearance === 'icon') {
    return (
      <button type="button" className={styles.icon} onClick={openFilter}>
        <SlidersHorizontal aria-hidden />
        <span className="sr-only">{count > 0 ? `필터, ${count}개 적용 중` : '필터'}</span>
      </button>
    );
  }
  return (
    <Button variant="soft" onClick={openFilter}>
      <SlidersHorizontal aria-hidden />
      {count > 0 ? `필터 ${count}` : '필터'}
    </Button>
  );
}
