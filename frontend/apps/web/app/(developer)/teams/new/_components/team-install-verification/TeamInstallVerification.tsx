'use client';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { isInstalledOrganization } from '../../_lib/installation';
import { useTeamSetupOutcome } from '../team-setup-outcome/hook';
import { useTeamInstallVerification } from './hook';

export function TeamInstallVerification() {
  const { request, verification, result, state, router } = useTeamInstallVerification();
  const outcome = useTeamSetupOutcome(state);

  if (request && (verification.isPending || isInstalledOrganization(result))) return <Skeleton />;
  if (verification.isError)
    return (
      <div className={styles.stack}>
        <ErrorState title="GitHub에 연결하지 못했어요." />
        <Button onClick={outcome.goSetup}>팀 만들기로 돌아가기</Button>
      </div>
    );
  return (
    <section className={`${styles.card} ${styles.stack}`}>
      <h2 className={styles.title}>{outcome.title}</h2>
      <p className={styles.description}>{outcome.description}</p>
      <Button onClick={() => router.replace('/teams/new')}>팀 만들기로 돌아가기</Button>
      {result?.result === 'ALREADY_LINKED' && (
        <Button variant="outline" onClick={outcome.goWorkspace}>
          내 팀 확인하기
        </Button>
      )}
    </section>
  );
}
