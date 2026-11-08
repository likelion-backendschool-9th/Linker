'use client';

// overlay: the team name in the 11–15 header opens the "팀 변경" sheet (Figma 368:1891)
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { teamEntryHref } from '@/features/teams/team-entry';

import { TeamChangeSheet } from '../../../../_components/team-change-sheet';
import { useTeamSwitcher } from './hook';
import styles from './TeamSwitcher.module.css';

/**
 * Header title of the team pages: the team name is the sheet trigger. Pressing "팀 변경" with the
 * current team just closes the sheet (URL kept); another team goes to its entry (`teamEntryHref`).
 */
export function TeamSwitcher({ teamId, name }: { teamId: string; name: string }) {
  const { overlay, teams } = useTeamSwitcher();
  const items = teams.data?.items;
  const choices = items?.map((team) => ({
    id: team.id,
    name: team.name,
    disabledReason: teamEntryHref(team) === null ? '채팅방을 찾지 못했어요' : undefined,
  }));

  function submit(id: number) {
    const team = items?.find((item) => item.id === id);
    const href = team && teamEntryHref(team);
    if (!team || String(team.id) === teamId || !href) {
      overlay.close();
      return;
    }
    void overlay.closeThen(href);
  }

  return (
    <TeamChangeSheet
      overlay={overlay}
      description="이동할 팀을 선택해 주세요."
      trigger={
        <button type="button" className={styles.trigger}>
          {name}
          <span className="sr-only"> 팀 변경</span>
        </button>
      }
      teams={choices && choices.length > 0 ? choices : null}
      status={
        teams.isPending ? (
          <Skeleton count={3} />
        ) : teams.isError ? (
          <ErrorState onRetry={() => void teams.refetch()} />
        ) : (
          <EmptyState title="참여 중인 팀이 없어요." />
        )
      }
      selectedId={Number(teamId)}
      name="team-switcher"
      onSubmit={submit}
    />
  );
}
