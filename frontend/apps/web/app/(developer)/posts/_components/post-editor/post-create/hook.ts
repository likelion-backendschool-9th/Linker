'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { emptyPostForm, repoSummaryOptions, type PostDraft } from './api';

const navParsers = {
  step: parseAsInteger.withDefault(1),
  repo: parseAsInteger,
  /** From 09's project-completion notice */
  teamId: parseAsString,
};

export const STEPS = ['레포 선택', '내용'] as const;
export const POST_DRAFT_NEW = 'draft:post:new';

export function usePostCreate() {
  const router = useRouter();
  const [nav, setNav] = useQueryStates(navParsers);
  // Step 2 was pushed on top of step 1 in this visit (vs. opened from a link)
  const pushedStep = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const draft = useDraft<PostDraft>(POST_DRAFT_NEW);
  const restoreSheet = useOverlay('draft-restore');
  const [restored, setRestored] = useState<PostDraft | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const asked = useRef(false);
  const pendingRestore = useRef<PostDraft | null>(null);

  const step = nav.step === 2 && nav.repo !== null ? 2 : 1;

  // "작성 중인 글 복구": ask once when the page opens and a draft is on the device (07 TODO 22)
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (draft.load()) restoreSheet.open();
  }, [draft, restoreSheet]);

  // The sheet closes with history.back(), which would undo a step change made while it was open
  useEffect(() => {
    const value = pendingRestore.current;
    if (restoreSheet.isOpen || !value) return;
    pendingRestore.current = null;
    pushedStep.current = true;
    void setNav({ step: 2, repo: value.repoId }, { history: 'push' });
  }, [restoreSheet.isOpen, setNav]);

  function selectRepo(repoId: number) {
    void setNav({ repo: repoId }, { history: 'replace' });
  }

  function goNext(repoId: number) {
    pushedStep.current = true;
    void setNav({ step: 2, repo: repoId }, { history: 'push' });
  }

  function changeRepo() {
    // Same as the browser back when we pushed step 2; otherwise swap this entry for step 1
    if (pushedStep.current) {
      pushedStep.current = false;
      window.history.back();
    } else void setNav({ step: 1 }, { history: 'replace' });
  }

  function onSaved(postId: number) {
    // Done writing: back must not reopen the editor (blueprint §7-4). Step 1's entry is
    // under ours when we pushed step 2, so go back over it first, then replace it.
    const detail = `/posts/${postId}` as Route;
    setLeaving(true);
    if (!pushedStep.current) return router.replace(detail);
    window.addEventListener('popstate', () => router.replace(detail), { once: true });
    window.history.back();
  }

  function onRestore() {
    const value = draft.load();
    if (!value) return;
    setRestored(value);
    setRestoreVersion((version) => version + 1);
    pendingRestore.current = value;
  }

  function onDiscard() {
    draft.clear();
  }

  return {
    nav,
    step,
    leaving,
    restored,
    restoreVersion,
    selectRepo,
    goNext,
    changeRepo,
    onSaved,
    onRestore,
    onDiscard,
  };
}

export function usePostCreateContentStep(repoId: number) {
  const viewer = useViewer();
  const summary = useQuery(repoSummaryOptions(viewer.login, repoId));
  return {
    summary,
    emptyValues: summary.data ? emptyPostForm(summary.data.description ?? '') : null,
  };
}
