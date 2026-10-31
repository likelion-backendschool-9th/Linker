'use client';

// Client boundary: reads the URL filters for the count and opens the filter sheet
import { SlidersHorizontal } from 'lucide-react';
import { useQueryStates } from 'nuqs';

import { Button } from '@/components/ui/button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { activeFilterCount, issueFilterParsers } from '../_lib/issue-filters';

/** "필터" button with the number of active filters (11, 14, 15) */
export function IssueFilterButton() {
  const overlay = useOverlay('issue-filter');
  const [filters] = useQueryStates(issueFilterParsers);
  const count = activeFilterCount(filters);
  return (
    <Button variant="soft" onClick={() => overlay.open()}>
      <SlidersHorizontal aria-hidden />
      {count > 0 ? `필터 ${count}` : '필터'}
    </Button>
  );
}
