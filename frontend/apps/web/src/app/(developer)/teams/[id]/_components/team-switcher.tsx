'use client';

// overlay: shared team picker for workspace navigation
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { myTeamsOptions } from '../_lib/team-queries';

export function TeamSwitcher({ teamId, name }: { teamId: string; name: string }) {
  const overlay = useOverlay('team-switcher');
  const teams = useQuery({ ...myTeamsOptions(), enabled: overlay.isOpen });
  return (
    <>
      <button
        type="button"
        className={styles.switcher}
        aria-haspopup="dialog"
        onClick={() => overlay.open()}
      >
        {name}
        <ChevronDown aria-hidden />
        <span className="sr-only">팀 전환</span>
      </button>
      <OverlaySheet overlay={overlay} title="팀 전환" description="이동할 팀을 선택해 주세요.">
        {teams.isPending ? (
          <Skeleton count={3} />
        ) : teams.isError ? (
          <ErrorState onRetry={() => void teams.refetch()} />
        ) : teams.data.items.length ? (
          <ul className={styles.list}>
            {teams.data.items.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  className={styles.picker}
                  aria-current={String(team.id) === teamId ? 'true' : undefined}
                  onClick={() =>
                    void overlay.closeThen(
                      (team.status === 'ARCHIVED'
                        ? `/chats/${team.chatRoomId}`
                        : `/teams/${team.id}/issues`) as Route,
                    )
                  }
                >
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
                    <span className={styles.meta}>{team.memberCount}명</span>
                  </span>
                  {String(team.id) === teamId && <Check aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="참여 중인 팀이 없어요." />
        )}
      </OverlaySheet>
    </>
  );
}
