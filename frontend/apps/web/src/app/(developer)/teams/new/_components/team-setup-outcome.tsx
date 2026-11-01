'use client';

// real reuse: setup completion preview and callback result states
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import styles from '@/features/teams/team-ui.module.css';

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
const MESSAGES: Record<SetupOutcome, [string, string]> = {
  UNVERIFIED: [
    '아직 GitHub 연결을 확인할 수 없어요.',
    '서버의 설치 검증 기능을 준비하고 있어요. URL의 설치 번호만으로 연결을 완료하지 않아요.',
  ],
  INSTALLED: ['GitHub 앱 설치를 확인했어요', '팀 이름과 소개를 입력하고 레포를 선택해 주세요.'],
  REQUESTED_FROM_OWNER: [
    '오너에게 설치 요청을 보냈어요',
    'GitHub 조직 오너가 승인한 뒤 팀 만들기를 다시 진행해 주세요.',
  ],
  ALREADY_LINKED: [
    '이미 Linker 팀에 연결된 조직이에요',
    'GitHub 조직 1개는 팀 1개에만 연결할 수 있어요. 내 팀을 확인하거나 다른 조직을 선택해 주세요.',
  ],
  CANCELLED: ['GitHub 앱 설치를 취소했어요', '준비가 되면 팀 만들기에서 다시 시작해 주세요.'],
  INVALID_RETURN: [
    '연결 확인에 필요한 정보가 없거나 일치하지 않아요',
    '팀 만들기에서 다시 시작해 주세요. 설치 번호만으로 팀을 만들지 않아요.',
  ],
  FAILED: ['GitHub에 연결하지 못했어요.', '팀 만들기로 돌아가 다시 시도해 주세요.'],
  COMPLETE: ['팀을 만들었어요', '초대 링크를 보내거나 모집 글을 작성해 팀원을 만나 보세요.'],
};

export function TeamSetupOutcome({ state, teamId }: { state: SetupOutcome; teamId?: string }) {
  const router = useRouter();
  const [step, setStep] = useQueryState('step', parseAsInteger);
  async function navigate(href: Route) {
    // nuqs updates are batched: finish the current step URL before leaving this flow.
    await setStep(step);
    router.replace(href);
  }
  const [title, description] = MESSAGES[state];
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
            <Button
              disabled={!teamId}
              onClick={() => void navigate(`/teams/${teamId}/settings` as Route)}
            >
              초대 링크 보내기
            </Button>
            <Button
              variant="outline"
              disabled={!teamId}
              onClick={() => void navigate(`/recruits/new?teamId=${teamId}` as Route)}
            >
              모집 글 쓰기
            </Button>
          </>
        ) : (
          <Button
            onClick={() =>
              void navigate(state === 'INSTALLED' ? '/teams/new?step=2' : '/teams/new')
            }
          >
            팀 만들기로 돌아가기
          </Button>
        )}
        <Button variant="outline" onClick={() => void navigate('/workspace')}>
          내 팀 확인하기
        </Button>
      </div>
      {state === 'COMPLETE' && !teamId && (
        <p className={styles.description}>팀이 생성되면 초대·모집 글 작성으로 이동할 수 있어요.</p>
      )}
    </section>
  );
}
