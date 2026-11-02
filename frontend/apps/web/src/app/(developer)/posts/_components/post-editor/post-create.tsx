'use client';

// Client boundary: steps in the URL (`?step=&repo=&teamId=`) and the device draft restore
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet';
import { useDraft } from '@/features/draft-restore/use-draft';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { repoSummaryOptions } from '../../_lib/editor-queries';
import { emptyPostForm, type PostDraft } from '../../_lib/schema';
import { PostContentForm } from './post-content-form';
import styles from './post-editor.module.css';
import { RepoStep } from './repo-step';

const navParsers = {
  step: parseAsInteger.withDefault(1),
  repo: parseAsInteger,
  /** From 09's project-completion notice */
  teamId: parseAsString,
};

const STEPS = ['레포 선택', '내용'] as const;
const POST_DRAFT_NEW = 'draft:post:new';

/** 22 Write project post: step 1 repo, step 2 content (07 TODO 22) */
export function PostCreate() {
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

  return (
    <div className={styles.editor}>
      <ol className={styles.steps} aria-label="작성 단계">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={styles.stepItem}
            aria-current={step === index + 1 ? 'step' : undefined}
          >
            <span className={styles.stepNumber} aria-hidden>
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {leaving ? (
        <LoadingIndicator label="올린 게시물로 이동하고 있어요." variant="block">
          <Skeleton count={2} />
        </LoadingIndicator>
      ) : step === 1 ? (
        <RepoStep
          teamId={nav.teamId}
          repoId={nav.repo}
          onSelect={(repoId) => void setNav({ repo: repoId }, { history: 'replace' })}
          onNext={(repoId) => {
            pushedStep.current = true;
            void setNav({ step: 2, repo: repoId }, { history: 'push' });
          }}
        />
      ) : (
        <ContentStep
          key={`${nav.repo}:${restoreVersion}`}
          repoId={nav.repo!}
          restored={restored?.repoId === nav.repo ? restored : null}
          onChangeRepo={() => {
            // Same as the browser back when we pushed step 2; otherwise swap this entry for step 1
            if (pushedStep.current) {
              pushedStep.current = false;
              window.history.back();
            } else void setNav({ step: 1 }, { history: 'replace' });
          }}
          onSaved={(postId) => {
            // Done writing: back must not reopen the editor (blueprint §7-4). Step 1's entry is
            // under ours when we pushed step 2, so go back over it first, then replace it.
            const detail = `/posts/${postId}` as Route;
            setLeaving(true);
            if (!pushedStep.current) return router.replace(detail);
            window.addEventListener('popstate', () => router.replace(detail), { once: true });
            window.history.back();
          }}
        />
      )}

      <DraftRestoreSheet
        onRestore={() => {
          const value = draft.load();
          if (!value) return;
          setRestored(value);
          setRestoreVersion((version) => version + 1);
          pendingRestore.current = value;
        }}
        onDiscard={() => draft.clear()}
      />
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
  const viewer = useViewer();
  const summary = useQuery(repoSummaryOptions(viewer.login, repoId));

  if (summary.isPending) {
    return (
      <LoadingIndicator label="레포 정보를 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    );
  }
  if (summary.isError) {
    return (
      <ErrorState title="레포 정보를 불러오지 못했어요" onRetry={() => void summary.refetch()} />
    );
  }

  return (
    <>
      <div className={styles.chosen}>
        <p className={styles.chosenText}>고른 레포</p>
        <Button variant="soft" onClick={onChangeRepo}>
          레포 바꾸기
        </Button>
      </div>
      <PostContentForm
        target={{ mode: 'create', repoId }}
        repo={summary.data}
        photoLimit={summary.data.photoLimit}
        // The body starts from the repo description (07 TODO 22)
        initial={
          restored
            ? { values: restored.values, photos: restored.photos }
            : { values: emptyPostForm(summary.data.description ?? ''), photos: [] }
        }
        draftKey={POST_DRAFT_NEW}
        onSaved={onSaved}
      />
    </>
  );
}
