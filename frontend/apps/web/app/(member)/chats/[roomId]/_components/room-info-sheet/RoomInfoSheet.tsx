'use client';

import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { ChevronLeft } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import { Dialog } from 'radix-ui';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlayLink } from '@/components/overlay/overlay-link/OverlayLink';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon/Icon';

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
 * Figma 17 room info (351:580), opened from the header ☰: a full screen with the team card, members
 * with their team role, and "팀 나가기". Mute and the PR list (not in the frame) sit under the members.
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
    mute,
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
            </div>
            <div className={styles.body}>
              {team && (
                <OverlayLink
                  overlay={overlay}
                  href={`/teams/${team.id}/issues` as Route}
                  className={styles.teamCard}
                >
                  <Photo src={team.avatarUrl} name={team.name} className={styles.teamPhoto} />
                  <span className={styles.teamText}>
                    <span className={styles.teamName}>{team.name}</span>
                    <span className={styles.teamMeta}>멤버 {members.length}명</span>
                  </span>
                  <span className={styles.chevron}>
                    <Icon svg={AltArrowRightLinearIcon} />
                  </span>
                </OverlayLink>
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
              <div className={styles.settings}>
                <button
                  type="button"
                  className={styles.settingRow}
                  aria-pressed={room.muted}
                  disabled={muteDisabled}
                  onClick={onToggleMute}
                >
                  {room.muted ? '알림 켜기' : '알림 끄기'}
                </button>
                {mute.isError && (
                  <ErrorState title="알림 설정을 바꾸지 못했어요" onRetry={onToggleMute} />
                )}
                {team && (
                  <button
                    type="button"
                    className={styles.settingRow}
                    onClick={() => pullRequests.open()}
                  >
                    PR 목록
                  </button>
                )}
              </div>
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
