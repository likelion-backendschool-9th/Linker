'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { issueDraftKey, type IssueDraft } from '../../_lib/issue-draft';

const navParsers = {
  repo: parseAsInteger,
  template: parseAsString,
};

/** Single-page create (Figma 200:806): repo + template live in the URL, no step. */
export function useIssueCreate(teamId: string) {
  const router = useRouter();
  const [nav, setNav] = useQueryStates(navParsers);
  const [leaving, setLeaving] = useState(false);
  const draft = useDraft<IssueDraft>(issueDraftKey(teamId));
  const restoreModal = useOverlay('issue-draft-restore');
  const [restored, setRestored] = useState<IssueDraft | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (draft.load()) restoreModal.open();
  }, [draft, restoreModal]);

  return {
    nav,
    leaving,
    restored,
    restoreVersion,
    setRepo: (repoId: number) =>
      setNav({ repo: repoId, template: null }, { history: 'replace' }),
    setTemplate: (templateKey: string) =>
      setNav({ repo: nav.repo, template: templateKey }, { history: 'replace' }),
    onCreated: (detail: Route) => {
      setLeaving(true);
      router.replace(detail);
    },
    onRestore: () => {
      const value = draft.load();
      if (!value) return;
      // Caller must close the restore overlay first (closeAnd) so history.back won't undo this
      void setNav({ repo: value.repoId, template: value.templateKey }, { history: 'replace' }).then(
        () => {
          setRestored(value);
          setRestoreVersion((version) => version + 1);
        },
      );
    },
    onDiscard: () => draft.clear(),
  };
}
