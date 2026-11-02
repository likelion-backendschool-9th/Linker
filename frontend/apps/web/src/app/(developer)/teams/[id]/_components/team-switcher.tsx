'use client';

// overlay: shared team picker for workspace navigation
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { OverlayLink } from '@/components/overlay/overlay-link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { myTeamsOptions } from '../_lib/team-queries';

const STATUS_LABELS = {
  ACTIVE: '활동 중',
  COMPLETED: '완료',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관됨',
};

export function TeamSwitcher({ teamId, name }: { teamId: string; name: string }) {
  const overlay = useOverlay('team-switcher');
  const teams = useQuery({ ...myTeamsOptions(), enabled: overlay.isOpen });
  return (
    <OverlaySheet
      overlay={overlay}
      title="팀 전환"
      description="이동할 팀을 선택해 주세요."
      trigger={
        <button type="button" className={styles.switcher} aria-label={`${name} 팀 전환`}>
          {name}
          <ChevronDown aria-hidden />
          <span className="sr-only">팀 전환</span>
        </button>
      }
    >
      {teams.isPending ? (
        <Skeleton count={3} />
      ) : teams.isError ? (
        <ErrorState onRetry={() => void teams.refetch()} />
      ) : teams.data.items.length ? (
        <ul className={styles.list}>
          {teams.data.items.map((team) => {
            const current = String(team.id) === teamId;
            const href = (
              team.status === 'ARCHIVED' ? `/chats/${team.chatRoomId}` : `/teams/${team.id}/issues`
            ) as Route;
            const content = (
              <>
                <Image
                  className={styles.avatar}
                  src={team.orgAvatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  sizes="40px"
                />
                <span className={styles.body}>
                  {team.name}
                  <span className={styles.meta}>
                    {team.memberCount}명 · {STATUS_LABELS[team.status]}
                  </span>
                </span>
                {current && (
                  <>
                    <Check aria-hidden />
                    <span className="sr-only">현재 팀</span>
                  </>
                )}
              </>
            );
            return (
              <li key={team.id}>
                {current ? (
                  <button
                    type="button"
                    className={styles.picker}
                    aria-current="true"
                    onClick={overlay.close}
                  >
                    {content}
                  </button>
                ) : (
                  <OverlayLink overlay={overlay} href={href} className={styles.picker}>
                    {content}
                  </OverlayLink>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="참여 중인 팀이 없어요." />
      )}
      <Button asChild variant="outline">
        <OverlayLink overlay={overlay} href="/workspace">
          워크스페이스로 가기
        </OverlayLink>
      </Button>
    </OverlaySheet>
  );
}
