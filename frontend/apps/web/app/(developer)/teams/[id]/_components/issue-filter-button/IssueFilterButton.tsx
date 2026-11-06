'use client';

import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button/Button';

import { useIssueFilterButton } from './hook';

/** "필터" button with the number of active filters (11, 14, 15) */
export function IssueFilterButton() {
  const { count, openFilter } = useIssueFilterButton();
  return (
    <Button variant="soft" onClick={openFilter}>
      <SlidersHorizontal aria-hidden />
      {count > 0 ? `필터 ${count}` : '필터'}
    </Button>
  );
}
