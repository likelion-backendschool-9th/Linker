'use client';

// Client boundary: edit form values and the device draft restore for one post
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet';
import { useDraft } from '@/features/draft-restore/use-draft';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { postEditFormOptions, type PostEditForm } from '../../_lib/editor-queries';
import type { PostDraft, PostFormValues } from '../../_lib/schema';
import { PostContentForm } from './post-content-form';
import styles from './post-editor.module.css';

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

/** 22 Edit project post: the content step only, the repo stays (07 TODO 22) */
export function PostEdit({ postId }: { postId: string }) {
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

  if (editForm.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">게시물을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (editForm.isError) return <ErrorState onRetry={() => void editForm.refetch()} />;

  const data = editForm.data;
  return (
    <div className={styles.editor}>
      <PostContentForm
        key={version}
        target={{ mode: 'edit', postId }}
        repo={data.repo}
        photoLimit={data.photoLimit}
        initial={
          restored
            ? { values: restored.values, photos: restored.photos }
            : { values: fromEditForm(data), photos: data.photos }
        }
        draftKey={draftKey}
        onSaved={(id) => router.replace(`/posts/${id}` as Route)}
      />
      <DraftRestoreSheet
        onRestore={() => {
          const value = draft.load();
          if (!value) return;
          setRestored(value);
          setVersion((current) => current + 1);
        }}
        onDiscard={() => draft.clear()}
      />
    </div>
  );
}
