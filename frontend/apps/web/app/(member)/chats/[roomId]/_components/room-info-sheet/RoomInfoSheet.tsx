'use client';

import { Bell, BellOff, ChevronLeft, Plus } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import { Dialog } from 'radix-ui';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlayLink } from '@/components/overlay/overlay-link/OverlayLink';

import type { RoomInfo } from './api';
import styles from './RoomInfoSheet.module.css';
import { useRoomInfoSheet } from './hook';

const ROLE_LABELS = { OWNER: '오너', ADMIN: '관리자', MEMBER: '멤버' } as const;

function Photo({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <span className={className} aria-hidden>
      {src ? <Image src={src} alt="" fill sizes="50px" /> : name.trim().slice(0, 1) || '?'}
    </span>
  );
}

/**
 * Figma 17 room info (351:580), opened from the header ☰, with the user's 2026-11-10 reference: a
 * full screen with "멤버 N명" (+ "초대하기" → 09 for owner/admin), the team card ("PR 보러 가기" chip), members with their team role,
 * and "팀 나가기". Mute (not in the frame) is the bell icon on the right of the header.
 */
export function RoomInfoSheet({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const {
    overlay,
    pullRequests,
    leaveConfirm,
    direct,
    muteDisabled,
    onToggleMute,
    leave,
    leaveDisabled,
    onConfirmLeave,
    members,
  } = useRoomInfoSheet({ room, login, disabled });
  const team = room.team;

  return (
    <>
      <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
        <Dialog.Portal>
          <Dialog.Content className={styles.screen} aria-describedby={undefined}>
            <div className={styles.header}>
              <Dialog.Close className={styles.back}>
                <ChevronLeft aria-hidden />
                <span className="sr-only">뒤로</span>
              </Dialog.Close>
              <Dialog.Title className={styles.title}>{room.title}</Dialog.Title>
              <button
                type="button"
                className={styles.mute}
                disabled={muteDisabled}
                onClick={onToggleMute}
              >
                {room.muted ? <BellOff aria-hidden /> : <Bell aria-hidden />}
                <span className="sr-only">{room.muted ? '알림 켜기' : '알림 끄기'}</span>
              </button>
            </div>
            <div className={styles.body}>
              {team && (
                <section className={styles.team} aria-labelledby="room-info-member-count">
                  <div className={styles.sectionHead}>
                    <h2 id="room-info-member-count" className={styles.sectionTitle}>
                      멤버 {members.length}명
                    </h2>
                    {/* Invite links are team ADMIN+ (WBS 09); the invite UI itself stays on 09 */}
                    {team.myRole !== 'MEMBER' && (
                      <OverlayLink
                        overlay={overlay}
                        href={`/teams/${team.id}/settings#team-invite-title` as Route}
                        className={styles.invite}
                      >
                        <Plus aria-hidden />
                        초대하기
                      </OverlayLink>
                    )}
                  </div>
                  <div className={styles.teamCard}>
                    <Photo src={team.avatarUrl} name={team.name} className={styles.teamPhoto} />
                    <span className={styles.teamText}>
                      <span className={styles.teamName}>{team.name}</span>
                      <button
                        type="button"
                        className={styles.prChip}
                        onClick={() => pullRequests.open()}
                      >
                        PR 보러 가기
                      </button>
                    </span>
                  </div>
                </section>
              )}
              <ul className={styles.members} aria-label="참여자">
                {members.map((member) => {
                  const content = (
                    <>
                      <Photo
                        src={member.avatarUrl}
                        name={member.name}
                        className={styles.memberPhoto}
                      />
                      <span className={styles.memberText}>
                        <span className={styles.memberName}>{member.name}</span>
                        {member.login && (
                          <span className={styles.memberLogin}>@{member.login}</span>
                        )}
                      </span>
                      {member.role && (
                        <span className={styles.role} data-role={member.role}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={member.id}>
                      {member.login ? (
                        <OverlayLink
                          overlay={overlay}
                          href={`/user/${member.login}` as Route}
                          className={styles.member}
                        >
                          {content}
                        </OverlayLink>
                      ) : (
                        <div className={styles.member}>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            {team ? (
              <OverlayLink
                overlay={overlay}
                href={`/teams/${team.id}/settings` as Route}
                className={styles.cta}
              >
                팀 나가기
              </OverlayLink>
            ) : (
              direct && (
                <button
                  type="button"
                  className={styles.cta}
                  disabled={leaveDisabled}
                  onClick={() => leaveConfirm.open(String(room.id))}
                >
                  대화 나가기
                </button>
              )
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {direct && (
        <ConfirmDialog
          overlay={leaveConfirm}
          title="대화에서 나갈까요?"
          description="내 채팅 목록에서 이 대화가 사라져요. 상대도 나가면 대화가 삭제돼요."
          confirmLabel="나가기"
          destructive
          pending={leave.isPending}
          error={
            leave.isError
              ? '대화에서 나가지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'
              : null
          }
          onConfirm={onConfirmLeave}
        />
      )}
    </>
  );
}
