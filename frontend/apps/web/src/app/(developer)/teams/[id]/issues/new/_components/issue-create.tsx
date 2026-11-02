'use client';

// Client boundary: steps in the URL (`?step=&repo=&template=`) and the device draft restore
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet';
import { useDraft } from '@/features/draft-restore/use-draft';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { issueDraftKey, type IssueDraft } from '../_lib/issue-draft';
import { IssueContentStep } from './issue-content-step';
import styles from './issue-create.module.css';
import { RepoTemplateStep } from './repo-template-step';

const navParsers = {
  step: parseAsInteger.withDefault(1),
  repo: parseAsInteger,
  template: parseAsString,
};

const STEPS = ['레포·템플릿', '내용'] as const;

/** 13 Create issue: step 1 repo + template, step 2 content (07 TODO 13) */
export function IssueCreate({ teamId }: { teamId: string }) {
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

  return (
    <>
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
        <LoadingIndicator label="만든 이슈로 이동하고 있어요." variant="block">
          <Skeleton count={2} />
        </LoadingIndicator>
      ) : step === 1 ? (
        <RepoTemplateStep
          teamId={teamId}
          repoId={nav.repo}
          templateKey={nav.template}
          onSelect={(repoId, templateKey) =>
            void setNav({ repo: repoId, template: templateKey }, { history: 'replace' })
          }
          onNext={(repoId, templateKey) => {
            pushedStep.current = true;
            void setNav({ step: 2, repo: repoId, template: templateKey }, { history: 'push' });
          }}
        />
      ) : (
        <IssueContentStep
          key={`${nav.repo}:${nav.template}:${restoreVersion}`}
          teamId={teamId}
          repoId={nav.repo!}
          templateKey={nav.template!}
          initial={
            restored && restored.repoId === nav.repo && restored.templateKey === nav.template
              ? restored
              : null
          }
          onChangeTemplate={() => {
            // Same as the browser back when we pushed step 2; otherwise swap this entry for step 1
            if (pushedStep.current) {
              pushedStep.current = false;
              window.history.back();
            } else void setNav({ step: 1 }, { history: 'replace' });
          }}
          onCreated={(detail: Route) => {
            // Done writing: back must not reopen the editor (blueprint §7-4). Step 1's entry is
            // under ours when we pushed step 2, so go back over it first, then replace it.
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
    </>
  );
}
