'use client';

import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';

import { IssueContentStep } from '../issue-content-step';
import styles from './IssueCreate.module.css';
import { STEPS, useIssueCreate } from './hook';
import { RepoTemplateStep } from '../repo-template-step';

/** 13 Create issue: step 1 repo + template, step 2 content (07 TODO 13) */
export function IssueCreate({ teamId }: { teamId: string }) {
  const {
    nav,
    step,
    leaving,
    restored,
    restoreVersion,
    onSelect,
    onNext,
    onChangeTemplate,
    onCreated,
    onRestore,
    onDiscard,
  } = useIssueCreate(teamId);

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
        <div aria-busy="true">
          <p role="status">만든 이슈로 이동하고 있어요.</p>
          <Skeleton count={2} />
        </div>
      ) : step === 1 ? (
        <RepoTemplateStep
          teamId={teamId}
          repoId={nav.repo}
          templateKey={nav.template}
          onSelect={onSelect}
          onNext={onNext}
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
          onChangeTemplate={onChangeTemplate}
          onCreated={onCreated}
        />
      )}

      <DraftRestoreSheet onRestore={onRestore} onDiscard={onDiscard} />
    </>
  );
}
