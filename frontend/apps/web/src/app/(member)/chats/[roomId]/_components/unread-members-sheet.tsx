'use client';

import { useQuery } from '@tanstack/react-query';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { ErrorState } from '@/components/ui/error-state';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { unreadMembersOptions, type RoomInfo, type RoomMessage } from '../_lib/room-api';
import styles from './chat-room.module.css';

type Props = { room: RoomInfo; messages: RoomMessage[]; login: string | null };

export function UnreadMembersSheet({ room, messages, login }: Props) {
  const overlay = useOverlay('chat-unread');
  const message = messages.find((item) => String(item.id) === overlay.id);
  const available = room.kind === 'TEAM' && message && !message.deletedAt &&
    message.visibility !== 'HIDDEN' && message.visibility !== 'UNDER_REVIEW' &&
    message.type !== 'SYSTEM' && message.type !== 'PR_EVENT';
  const query = useQuery(unreadMembersOptions(login, room.id, available ? message.id : null));
  return (
    <OverlaySheet overlay={overlay} title="안 읽은 사람" description="아직 이 메시지를 읽지 않은 참여자예요.">
      {!available ? <p>읽음 상태를 확인할 수 없는 메시지예요.</p> :
        query.isPending ? <p role="status">참여자를 불러오고 있어요.</p> :
        query.isError ? <ErrorState title="참여자를 불러오지 못했어요" onRetry={() => { void query.refetch(); }} /> :
        query.data.items.length ? (
          <ul aria-label="안 읽은 참여자">
            {query.data.items.map((member) => <li className={styles.member} key={member.id}>{member.name}</li>)}
          </ul>
        ) : <p role="status">모두 읽었어요.</p>}
    </OverlaySheet>
  );
}
