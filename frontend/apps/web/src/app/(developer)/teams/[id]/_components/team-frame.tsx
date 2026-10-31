import { MessageCircle } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PageFrame } from '@/components/layout/page-frame';

import { getTeam } from '../_lib/get-team';
import styles from './team-frame.module.css';
import { TeamNav } from './team-nav';

type TeamFrameProps = {
  teamId: string;
  /** The page's h1: "이슈", "상태 보드", "캘린더" */
  title: string;
  children: ReactNode;
};

const STATUS_NOTE: Partial<Record<string, string>> = {
  COMPLETED: '완료된 팀',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관된 팀',
};

/** Team layout shared by 11–15 (07 TODO 4장): team name, team chat shortcut, team menu tabs. */
export async function TeamFrame({ teamId, title, children }: TeamFrameProps) {
  const team = await getTeam(teamId);
  const note = STATUS_NOTE[team.status];

  return (
    <PageFrame title={title}>
      <div className={styles.team}>
        <Image
          src={team.orgAvatarUrl}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className={styles.avatar}
        />
        <p className={styles.name}>
          {team.name}
          {note && <span className={styles.badge}>{note}</span>}
        </p>
        <Link href={`/chats/${team.chatRoomId}` as Route} className={styles.chat}>
          <MessageCircle aria-hidden />
          <span className="sr-only">팀 채팅으로 가기</span>
        </Link>
      </div>
      <TeamNav teamId={teamId} />
      {children}
    </PageFrame>
  );
}
