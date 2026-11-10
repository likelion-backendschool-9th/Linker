'use client';

import { useQuery } from '@tanstack/react-query';

import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { CreatePickSheet } from '../create-pick-sheet';
import { IssueContentStep } from '../issue-content-step';
import { IssueDraftRestoreModal } from '../issue-draft-restore-modal';
import { createReposOptions, templatesOptions } from '../repo-template-step/api';
import { useIssueCreate } from './hook';

/** 13 Create issue — one scroll page (Figma 200:806). */
export function IssueCreate({ teamId }: { teamId: string }) {
  const {
    nav,
    leaving,
    restored,
    restoreVersion,
    setRepo,
    setTemplate,
    onCreated,
    onRestore,
    onDiscard,
  } = useIssueCreate(teamId);
  const repoSheet = useOverlay('issue-create-repo');
  const templateSheet = useOverlay('issue-create-template');

  const repos = useQuery(createReposOptions(teamId));
  const repoItems = repos.data?.items ?? [];
  const repoId = nav.repo;
  const templates = useQuery({
    ...templatesOptions(teamId, repoId ?? 0),
    enabled: repoId !== null,
  });
  const templateItems = templates.data?.items ?? [];

  if (leaving) {
    return (
      <div aria-busy="true">
        <p role="status">만든 이슈로 이동하고 있어요.</p>
        <Skeleton count={2} />
      </div>
    );
  }

  const repoLabel = repoItems.find((repo) => repo.id === repoId)?.name ?? null;
  const templateLabel = templateItems.find((item) => item.key === nav.template)?.name ?? null;

  return (
    <>
      <IssueContentStep
        key={`${nav.repo}:${nav.template}:${restoreVersion}`}
        teamId={teamId}
        repoId={repoId}
        templateKey={nav.template}
        repoLabel={repoLabel}
        templateLabel={templateLabel}
        onOpenRepo={() => repoSheet.open()}
        onOpenTemplate={() => {
          if (repoId !== null) templateSheet.open();
        }}
        initial={
          restored && restored.repoId === nav.repo && restored.templateKey === nav.template
            ? restored
            : null
        }
        onCreated={onCreated}
      />

      <CreatePickSheet
        overlayKey="issue-create-repo"
        title="저장소 변경"
        value={repoId !== null ? String(repoId) : null}
        options={repoItems.map((repo) => ({ value: String(repo.id), label: repo.name }))}
        empty="저장소가 없어요."
        onChange={(value) => setRepo(Number(value))}
      />
      <CreatePickSheet
        overlayKey="issue-create-template"
        title="템플릿 선택"
        value={nav.template}
        options={templateItems.map((item) => ({ value: item.key, label: item.name }))}
        empty="선택할 템플릿이 없어요."
        onChange={setTemplate}
      />

      <IssueDraftRestoreModal onRestore={onRestore} onDiscard={onDiscard} />
    </>
  );
}
