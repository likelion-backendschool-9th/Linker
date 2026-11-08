import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { getTeam } from './api';
import styles from './TeamFrame.module.css';
import { TeamNav } from '../team-nav';
import { TeamSwitcher } from '../team-switcher';

type TeamFrameProps = {
  teamId: string;
  /** The page's name: "이슈", "상태 보드", "캘린더" (read with the team name in the h1) */
  title: string;
  /** Header actions of the page, e.g. 11's filter icon */
  actions?: ReactNode;
  children: ReactNode;
};

const STATUS_NOTE: Partial<Record<string, string>> = {
  COMPLETED: '완료된 팀',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관된 팀',
};

/**
 * Team layout shared by 11–15 and 09 (07 TODO 4장), Figma 11 (197:66): back + team name (opens the
 * "팀 변경" sheet) + page actions, underlined team tabs, and the team chat shortcut button.
 */
export async function TeamFrame({ teamId, title, actions, children }: TeamFrameProps) {
  const team = await getTeam(teamId);
  const note = STATUS_NOTE[team.status];

  return (
    <PageFrame
      title={title}
      variant="stack"
      backHref="/workspace"
      titleContent={
        <>
          <TeamSwitcher teamId={teamId} name={team.name} />
          <span className="sr-only">
            , {title}
            {note ? `, ${note}` : ''}
          </span>
        </>
      }
      actions={actions}
    >
      <TeamNav teamId={teamId} />
      {children}
      {team.chatRoomId !== null && (
        <Link href={`/chats/${team.chatRoomId}` as Route} className={styles.chat}>
          {/* Figma solar:chat-round-line-linear (package SVG string) */}
          <span
            aria-hidden
            className={styles.chatIcon}
            dangerouslySetInnerHTML={{ __html: ChatRoundLineLinearIcon }}
          />
          <span className="sr-only">
            팀 채팅으로 가기
            {team.unreadCount !== null && team.unreadCount > 0
              ? `, 안 읽은 메시지 ${team.unreadCount}개`
              : ''}
          </span>
        </Link>
      )}
    </PageFrame>
  );
}
