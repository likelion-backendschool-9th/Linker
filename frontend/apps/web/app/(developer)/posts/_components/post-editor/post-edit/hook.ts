'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import {
  postEditFormOptions,
  type PostDraft,
  type PostEditForm,
  type PostFormValues,
} from './api';

function fromEditForm(form: PostEditForm): PostFormValues {
  return {
    intro: form.intro,
    body: form.body,
    myRole: form.myRole ?? '',
    demoLinks: form.demoLinks.map((url) => ({ url })),
    periodStart: form.period?.start ?? '',
    periodEnd: form.period?.end ?? '',
    teamSize: form.teamSize === null ? '' : String(form.teamSize),
    tags: form.tags,
  };
}

export function usePostEdit(postId: string) {
  const viewer = useViewer();
  const router = useRouter();
  const editForm = useQuery(postEditFormOptions(viewer.login, postId));
  const draftKey = `draft:post:${postId}`;
  const draft = useDraft<PostDraft>(draftKey);
  const restoreSheet = useOverlay('draft-restore');
  const [restored, setRestored] = useState<PostDraft | null>(null);
  const [version, setVersion] = useState(0);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (draft.load()) restoreSheet.open();
  }, [draft, restoreSheet]);

  function onRestore() {
    const value = draft.load();
    if (!value) return;
    setRestored(value);
    setVersion((current) => current + 1);
  }

  function onDiscard() {
    draft.clear();
  }

  function onSaved(id: number) {
    router.replace(`/posts/${id}` as Route);
  }

  const initial =
    editForm.data == null
      ? null
      : restored
        ? { values: restored.values, photos: restored.photos }
        : { values: fromEditForm(editForm.data), photos: editForm.data.photos };

  return {
    editForm,
    draftKey,
    version,
    initial,
    onRestore,
    onDiscard,
    onSaved,
  };
}
