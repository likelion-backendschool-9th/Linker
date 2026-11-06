'use client';

// per-role view: guest prompt, recruiter guidance, read-only developer action
import { Button } from '@/components/ui/button/Button';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireLogin } from '@/features/auth/use-require-login';
import styles from '@/features/teams/team-ui.module.css';
import { useViewer } from '@/lib/auth/viewer-context';
import { TEAM } from '@/lib/policy';
import { teamPlanHref } from '@/lib/navigation/collaboration-links';
import type { Invite } from '../../_lib/get-invite';

export function InviteAcceptArea({
  code,
  teamId,
  participation,
}: {
  code: string;
  teamId: number;
  participation: Invite['participation'];
}) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  if (viewer.role === 'guest')
    return (
      <Button block onClick={() => requireLogin(`/invite/${encodeURIComponent(code)}`)}>
        GitHub로 시작하고 참여하기
      </Button>
    );
  if (viewer.role === 'recruiter')
    return <p className={styles.soft}>개발자 계정만 팀에 참여할 수 있어요</p>;
  if (participation.state === 'ALREADY_MEMBER' || participation.state === 'ACCEPTED')
    return (
      <div className={styles.section}>
        <p className={styles.soft}>
          {participation.state === 'ALREADY_MEMBER' ? '이미 함께하는 팀이에요' : '팀에 참여했어요'}
        </p>
        <p className={styles.description}>
          GitHub 조직 초대를 수락해야 이슈 담당자가 될 수 있어요.
        </p>
        <Button asChild>
          <Link href={`/teams/${teamId}/issues` as Route}>팀 이슈로 가기</Link>
        </Button>
      </div>
    );
  if (participation.state === 'TEAM_MEMBER_LIMIT')
    return (
      <div className={styles.section}>
        <p className={styles.soft}>팀 인원이 가득 찼어요</p>
        <p className={styles.description}>
          팀 오너에게 Flex 구독을 요청해 주세요. 기존 멤버는 계속 함께할 수 있어요.
        </p>
        {participation.canManageTeam && (
          <Button asChild variant="outline">
            <Link href={teamPlanHref(teamId, 'FREE')}>Flex 알아보기</Link>
          </Button>
        )}
      </div>
    );
  if (participation.state === 'TEAM_COUNT_LIMIT')
    return (
      <p className={styles.soft}>
        팀은 {TEAM.maxTeamsPerUser}개까지 참여할 수 있어요. 보관된 팀은 제외해요.
      </p>
    );
  if (participation.state === 'READ_ONLY' || participation.state === 'ARCHIVED')
    return (
      <p className={styles.soft}>
        {participation.state === 'READ_ONLY'
          ? '읽기 전용 팀에는 참여할 수 없어요. 팀 오너에게 GitHub 앱 재설치를 요청해 주세요.'
          : '보관된 팀에는 새로 참여할 수 없어요.'}
      </p>
    );
  return (
    <div className={styles.section}>
      <Button block disabled aria-describedby="invite-accept-notice">
        팀에 참여하기
      </Button>
      <p id="invite-accept-notice" className={styles.description}>
        {viewer.status === 'SUSPENDED'
          ? '이용이 제한된 동안에는 팀에 참여할 수 없어요.'
          : '팀 참여 기능은 준비 중이에요. 아직 팀에 가입되지 않아요.'}
      </p>
    </div>
  );
}
