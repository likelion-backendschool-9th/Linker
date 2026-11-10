'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import styles from '@/features/teams/team-ui.module.css';
import { useViewer } from '@/lib/auth/viewer-context';
import type { useOverlay } from '@/lib/navigation/use-overlay';
import type { Members, TeamSettings } from './api';

/** Missing 09 entry points reuse the existing settings icon and common sheet. */
export function TeamSettingsMenu({
  team,
  members,
  overlay,
}: {
  team: TeamSettings;
  members: Members['items'];
  overlay: ReturnType<typeof useOverlay>;
}) {
  const viewer = useViewer();
  const writable =
    viewer.status !== 'SUSPENDED' && !['READ_ONLY', 'ARCHIVED'].includes(team.status);
  const p = team.permissions;
  const actions = [
    { id: 'info', label: '팀 정보 편집', allowed: p.editInfo },
    { id: 'invites', label: '초대 링크 관리', allowed: p.createInviteLink },
    { id: 'transfer', label: '소유권 이전', allowed: p.transferOwnership },
    {
      id: 'accept-transfer',
      label: '소유권 이전 수락',
      allowed: !!team.ownershipTransfer?.isRecipient,
    },
    {
      id: 'complete',
      label: '프로젝트 완료',
      allowed: p.completeProject && team.status === 'ACTIVE',
    },
    { id: 'undo-completion', label: '완료 취소', allowed: !!team.completion?.canUndo },
    { id: 'archive', label: '팀 보관', allowed: p.archive },
  ];
  return (
    <OverlaySheet overlay={overlay} title="팀 설정" description="팀 설정" describeHidden>
      <div className={styles.stack}>
        {writable &&
          actions
            .filter((action) => action.allowed)
            .map((action) => (
              <Button key={action.id} variant="outline" onClick={() => overlay.open(action.id)}>
                {action.label}
              </Button>
            ))}
        {team.completedAt && (
          <Button variant="outline" onClick={() => overlay.open('completion')}>
            프로젝트 완료 내역
          </Button>
        )}
        <section className={styles.section} aria-label="팀 플랜">
          <h3 className={styles.title}>팀 플랜</h3>
          <p>{team.plan === 'FLEX' ? 'Flex' : 'Free'}</p>
          <p>팀원 {members.length}명</p>
          <p>결제 담당자: {team.billing.managerName ?? '—'}</p>
          <Button
            variant="outline"
            onClick={() =>
              void overlay.closeThen(
                team.billing.canManage ? `/subscribe?teamId=${team.id}` : '/subscribe',
              )
            }
          >
            플랜 보기
          </Button>
          {team.billing.canManage && (
            <Button
              variant="outline"
              onClick={() => void overlay.closeThen('/settings/subscription')}
            >
              구독 관리
            </Button>
          )}
        </section>
        <section className={styles.section} aria-label="GitHub 조직">
          <h3 className={styles.title}>GitHub 조직</h3>
          <p>{team.orgLogin}</p>
          {team.githubInvitationBlockedReason && <p>{team.githubInvitationBlockedReason}</p>}
        </section>
      </div>
    </OverlaySheet>
  );
}
