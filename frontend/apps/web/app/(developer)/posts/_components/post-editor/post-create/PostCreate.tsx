'use client';

// Client boundary: steps in the URL (`?step=&repo=&teamId=`) and the device draft restore
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';

import { PostContentForm } from '../post-content-form';
import styles from '../post-editor.module.css';
import { RepoStep } from '../repo-step';
import type { PostDraft } from './api';
import { POST_DRAFT_NEW, STEPS, usePostCreate, usePostCreateContentStep } from './hook';

/** 22 Write project post: step 1 repo, step 2 content (07 TODO 22) */
export function PostCreate() {
  const {
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
  } = usePostCreate();

  return (
    <div className={styles.editor}>
      <ol className={styles.steps} aria-label="작성 단계">
        {STEPS.map((label, index) => {
          const reached = index < step;
          return (
            <li
              key={label}
              className={reached ? styles.stepItemReached : styles.stepItem}
              aria-current={step === index + 1 ? 'step' : undefined}
            >
              <span className="sr-only">
                {index + 1}. {label}
                {reached ? ' 완료' : ''}
              </span>
            </li>
          );
        })}
      </ol>

      {leaving ? (
        <div aria-busy="true">
          <p role="status">올린 게시물로 이동하고 있어요.</p>
          <Skeleton count={2} />
        </div>
      ) : step === 1 ? (
        <RepoStep
          teamId={nav.teamId}
          repoId={nav.repo}
          onSelect={selectRepo}
          onNext={goNext}
        />
      ) : (
        <ContentStep
          key={`${nav.repo}:${restoreVersion}`}
          repoId={nav.repo!}
          restored={restored?.repoId === nav.repo ? restored : null}
          onChangeRepo={changeRepo}
          onSaved={onSaved}
        />
      )}

      <DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />
    </div>
  );
}

type ContentStepProps = {
  repoId: number;
  restored: PostDraft | null;
  onChangeRepo: () => void;
  onSaved: (postId: number) => void;
};

function ContentStep({ repoId, restored, onChangeRepo, onSaved }: ContentStepProps) {
  const { summary, emptyValues } = usePostCreateContentStep(repoId);

  if (summary.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">레포 정보를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (summary.isError) {
    return (
      <ErrorState title="레포 정보를 불러오지 못했어요" onRetry={() => void summary.refetch()} />
    );
  }

  return (
    <PostContentForm
      target={{ mode: 'create', repoId }}
      repo={summary.data}
      photoLimit={summary.data.photoLimit}
      initial={
        restored
          ? { values: restored.values, photos: restored.photos }
          : { values: emptyValues!, photos: [] }
      }
      draftKey={POST_DRAFT_NEW}
      onSaved={onSaved}
      onChangeRepo={onChangeRepo}
    />
  );
}
