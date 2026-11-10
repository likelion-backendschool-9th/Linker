'use client';

import { Button } from '@/components/ui/button/Button';
import styles from '@/features/teams/team-ui.module.css';

import { useTeamSetupOutcome } from './hook';

export const SETUP_OUTCOMES = [
  'UNVERIFIED',
  'INSTALLED',
  'REQUESTED_FROM_OWNER',
  'ALREADY_LINKED',
  'CANCELLED',
  'INVALID_RETURN',
  'FAILED',
  'COMPLETE',
] as const;
export type SetupOutcome = (typeof SETUP_OUTCOMES)[number];
export const OUTCOME_LABELS: Record<SetupOutcome, string> = {
  UNVERIFIED: '연결 확인 전',
  INSTALLED: '설치 확인',
  REQUESTED_FROM_OWNER: '오너 승인 대기',
  ALREADY_LINKED: '이미 연결된 조직',
  CANCELLED: '설치 취소',
  INVALID_RETURN: '잘못된 복귀',
  FAILED: '연결 실패',
  COMPLETE: '팀 생성 완료',
};

export function TeamSetupOutcome({ state, teamId }: { state: SetupOutcome; teamId?: string }) {
  const { title, description, goInvite, goRecruit, goSetup, goWorkspace } = useTeamSetupOutcome(
    state,
    teamId,
  );
  return (
    <section className={`${styles.card} ${styles.section}`} aria-labelledby="setup-outcome-title">
      <h2 id="setup-outcome-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.description}>{description}</p>
      {state !== 'UNVERIFIED' && (
        <p className={styles.soft}>
          상태 화면 미리보기예요. 실제 설치·팀 생성·동기화는 실행되지 않았어요.
        </p>
      )}
      <div className={styles.actions}>
        {state === 'COMPLETE' ? (
          <>
            <Button disabled={!teamId} onClick={goInvite}>
              초대 링크 보내기
            </Button>
            <Button variant="outline" disabled={!teamId} onClick={goRecruit}>
              모집 글 쓰기
            </Button>
          </>
        ) : (
          <Button onClick={goSetup}>팀 만들기로 돌아가기</Button>
        )}
        <Button variant="outline" onClick={goWorkspace}>
          내 팀 확인하기
        </Button>
      </div>
      {state === 'COMPLETE' && !teamId && (
        <p className={styles.description}>팀이 생성되면 초대·모집 글 작성으로 이동할 수 있어요.</p>
      )}
    </section>
  );
}
