'use client';

// overlay: "변경 하기" on the chosen repo card opens "저장소 변경" (Figma 676:836) — the shared
// radio sheet of 07/11, so step 2 keeps what's written instead of going back to step 1
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { TeamChangeSheet } from '../../../../_components/team-change-sheet';
import { useRepoChangeSheet } from './hook';

type RepoChangeSheetProps = {
  repoId: number;
  /** From 09's project-completion notice: the same team-narrowed list as step 1 */
  teamId: string | null;
  triggerClassName?: string;
  onChange: (repoId: number) => void;
};

function repoName(fullName: string) {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

export function RepoChangeSheet({
  repoId,
  teamId,
  triggerClassName,
  onChange,
}: RepoChangeSheetProps) {
  const { overlay, repos } = useRepoChangeSheet(teamId);
  const choices = repos.data?.items.map((repo) => ({
    id: repo.repoId,
    name: repoName(repo.fullName),
    disabledReason:
      repo.alreadyPosted && repo.repoId !== repoId ? '이미 피드에 올린 저장소' : undefined,
  }));

  function submit(id: number) {
    if (id === repoId) {
      overlay.close();
      return;
    }
    // Close first: the sheet's history.back() would undo a URL change made while it's open
    void overlay.closeAnd(() => onChange(id));
  }

  return (
    <TeamChangeSheet
      overlay={overlay}
      title="저장소 변경"
      submitLabel="변경"
      description="피드에 올릴 저장소를 골라 주세요."
      trigger={
        <button type="button" className={triggerClassName}>
          변경 하기
        </button>
      }
      teams={choices && choices.length > 0 ? choices : null}
      status={
        repos.isError ? (
          <ErrorState title="레포를 불러오지 못했어요" onRetry={() => void repos.refetch()} />
        ) : (
          <Skeleton count={3} />
        )
      }
      selectedId={repoId}
      name="post-repo"
      onSubmit={submit}
    />
  );
}
