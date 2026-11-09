'use client';

import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { DraftRestoreSheet } from '@/features/draft-restore/draft-restore-sheet/DraftRestoreSheet';

import { IssueContentStep } from '../issue-content-step';
import { RepoTemplateStep } from '../repo-template-step';
import { useIssueCreate } from './hook';

/** 13 Create issue: step 1 repo + template, step 2 content (Figma 200:806). */
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
