'use client';

// Client boundary: edit form values and the device draft restore for one post
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';

import { PostContentForm } from '../post-content-form';
import styles from '../post-editor.module.css';
import { usePostEdit } from './hook';

/** 22 Edit project post: the content step only, the repo stays (07 TODO 22) */
export function PostEdit({ postId }: { postId: string }) {
  const { editForm, draftKey, version, initial, onRestore, onDiscard, onSaved } =
    usePostEdit(postId);

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
        initial={initial!}
        draftKey={draftKey}
        onSaved={onSaved}
      />
      <DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />
    </div>
  );
}
