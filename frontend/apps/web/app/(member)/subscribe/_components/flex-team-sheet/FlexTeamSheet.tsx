'use client';

// overlay: Flex needs a team (Page TODO 28); Figma has no frame, so it borrows the 07 sheet look
import type { UseQueryResult } from '@tanstack/react-query';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatWon } from '@/lib/format/number';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { TeamCandidate } from './api';
import styles from './FlexTeamSheet.module.css';
import { useFlexTeamSheet } from './hook';

type Props = {
  overlay: OverlayControl;
  teams: UseQueryResult<{ items: TeamCandidate[] }, unknown>;
  initialTeamId: string;
  pending: boolean;
  error: string | null;
  disabled: boolean;
  /** 연간 결제 tab: show each team's yearly amount */
  yearly: boolean;
  onSubmit: (teamId: number) => void;
};

export function FlexTeamSheet({
  overlay,
  teams,
  initialTeamId,
  pending,
  error,
  disabled,
  yearly,
  onSubmit,
}: Props) {
  const { selectedId, setDraft, forged, submit } = useFlexTeamSheet({
    teams: teams.data?.items,
    initialTeamId,
    onSubmit,
  });

  return (
    <OverlaySheet
      overlay={overlay}
      title="결제할 팀 선택"
      description="내가 오너이거나 결제 담당자인 팀만 고를 수 있어요."
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      {teams.isPending ? (
        <p role="status">결제할 팀을 확인하고 있어요.</p>
      ) : teams.isError ? (
        <ErrorState
          title="팀 목록을 불러오지 못했어요"
          onRetry={() => {
            void teams.refetch();
          }}
        />
      ) : !teams.data.items.length ? (
        <p className={styles.empty}>결제할 수 있는 팀이 없어요.</p>
      ) : (
        <form onSubmit={submit}>
          {forged && (
            <p className={styles.notice}>
              이 팀을 선택할 수 없어요. 결제할 수 있는 팀 목록에서 다시 선택해 주세요.
            </p>
          )}
          <fieldset className={styles.choices} disabled={pending}>
            <legend className="sr-only">결제할 팀</legend>
            {teams.data.items.map((team) => (
              <label key={team.teamId} className={styles.choice}>
                <input
                  type="radio"
                  name="flex-team"
                  className={styles.radioInput}
                  checked={String(team.teamId) === selectedId}
                  onChange={() => setDraft(String(team.teamId))}
                />
                <span className={styles.radio} aria-hidden />
                <span className={styles.choiceText}>
                  <span className={styles.choiceName}>{team.name}</span>
                  <span className={styles.choiceMeta}>
                    {team.memberCount}명 ·{' '}
                    {yearly
                      ? `${formatWon(team.yearlyAmount)} / 년`
                      : `${formatWon(team.amount)} / 월`}
                    {team.currentPlan === 'FLEX' && ' · Flex 이용 중'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className={styles.note}>인원이 바뀌면 다음 결제일부터 반영돼요</p>
          {error && <ErrorState title="주문을 준비하지 못했어요" description={error} />}
          <button
            type="submit"
            className={styles.submit}
            disabled={disabled || pending || !selectedId}
          >
            {pending ? '주문 준비 중…' : 'Flex 결제 준비'}
          </button>
        </form>
      )}
    </OverlaySheet>
  );
}
