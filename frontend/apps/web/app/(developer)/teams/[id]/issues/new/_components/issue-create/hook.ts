'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { issueDraftKey, type IssueDraft } from '../../_lib/issue-draft';

const navParsers = {
  step: parseAsInteger.withDefault(1),
  repo: parseAsInteger,
  template: parseAsString,
};

export const STEPS = ['레포·템플릿', '내용'] as const;

export function useIssueCreate(teamId: string) {
  const router = useRouter();
  const [nav, setNav] = useQueryStates(navParsers);
  // Step 2 was pushed on top of step 1 in this visit (vs. opened from a link)
  const pushedStep = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const draft = useDraft<IssueDraft>(issueDraftKey(teamId));
  const restoreSheet = useOverlay('draft-restore');
  const [restored, setRestored] = useState<IssueDraft | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const asked = useRef(false);
  const pendingRestore = useRef<IssueDraft | null>(null);

  const step = nav.step === 2 && nav.repo !== null && nav.template ? 2 : 1;

  // "작성 중인 글 복구": ask once when the page opens and a draft is on the device (07 TODO 13)
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (draft.load()) restoreSheet.open();
  }, [draft, restoreSheet]);

  // The sheet closes with history.back(), which would undo a step change made while it was open,
  // so moving to the draft's step waits until it has closed
  useEffect(() => {
    const value = pendingRestore.current;
    if (restoreSheet.isOpen || !value) return;
    pendingRestore.current = null;
    pushedStep.current = true;
    void setNav({ step: 2, repo: value.repoId, template: value.templateKey }, { history: 'push' });
  }, [restoreSheet.isOpen, setNav]);

  return {
    nav,
    step,
    leaving,
    restored,
    restoreVersion,
    onSelect: (repoId: number | null, templateKey: string | null) =>
      void setNav({ repo: repoId, template: templateKey }, { history: 'replace' }),
    onNext: (repoId: number, templateKey: string) => {
      pushedStep.current = true;
      void setNav({ step: 2, repo: repoId, template: templateKey }, { history: 'push' });
    },
    onChangeTemplate: () => {
      // Same as the browser back when we pushed step 2; otherwise swap this entry for step 1
      if (pushedStep.current) {
        pushedStep.current = false;
        window.history.back();
      } else void setNav({ step: 1 }, { history: 'replace' });
    },
    onCreated: (detail: Route) => {
      // Done writing: back must not reopen the editor (blueprint §7-4). Step 1's entry is
      // under ours when we pushed step 2, so go back over it first, then replace it.
      setLeaving(true);
      if (!pushedStep.current) return router.replace(detail);
      window.addEventListener('popstate', () => router.replace(detail), { once: true });
      window.history.back();
    },
    onRestore: () => {
      const value = draft.load();
      if (!value) return;
      setRestored(value);
      setRestoreVersion((version) => version + 1);
      pendingRestore.current = value;
    },
    onDiscard: () => draft.clear(),
  };
}
