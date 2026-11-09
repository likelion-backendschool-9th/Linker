'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useTeamSetupCompletion } from './hook';
import { TeamSetupPermissionSheet } from './TeamSetupPermissionSheet';
import styles from './TeamSetupCompletion.module.css';

export function TeamSetupCompletion({ teamId }: { teamId: number | null }) {
  const router = useRouter();
  const finish = useTeamSetupCompletion(teamId);
  return (
    <section className={styles.completion} aria-label="팀 생성 완료">
      <div className={styles.content}>
        {finish.done ? (
          <>
            <Image
              className={styles.illustration}
              src="/images/team-setup/high-five.png"
              alt=""
              width={500}
              height={471}
              sizes="180px"
            />
            <div className={styles.copy}>
              <h2>팀을 생성 하셨습니다!</h2>
              <p>이제 팀원을 모으고 쉽게 가볍게 프로젝트를 진행해 보세요</p>
            </div>
          </>
        ) : !teamId ? (
          <EmptyState title="GitHub 조직을 먼저 연결해 주세요." />
        ) : finish.pending ? (
          <Skeleton variant="line" count={3} />
        ) : (
          <ErrorState
            title={finish.error?.message ?? '팀 생성 완료 상태를 확인해 주세요.'}
            onRetry={finish.start}
          />
        )}
      </div>
      <button
        className={styles.next}
        type="button"
        disabled={!finish.done}
        onClick={() => {
          if (finish.done && teamId) router.replace(`/workspace?teamId=${teamId}`);
        }}
      >
        다음
      </button>
      <TeamSetupPermissionSheet finish={finish} />
    </section>
  );
}
