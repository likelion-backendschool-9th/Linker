'use client';

import { useState, type FormEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

export function useMyIssuesTeamOverlay() {
  return useOverlay('my-issues-team');
}

/**
 * The draft lives only while the sheet is open. The URL changes after closing (`closeAnd`):
 * `history.back()` would undo a change made while it was open.
 */
export function useMyIssuesTeamForm(
  overlay: ReturnType<typeof useMyIssuesTeamOverlay>,
  selectedId: number,
  onSelect: (id: number) => unknown,
) {
  const [draftId, setDraftId] = useState(selectedId);

  function submit(event: FormEvent) {
    event.preventDefault();
    void overlay.closeAnd(() => onSelect(draftId));
  }

  return { draftId, setDraftId, submit };
}
