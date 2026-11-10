'use client';

// overlay: the feed card's paper-plane icon opens "공유하기" (Figma 780:584)
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { X } from 'lucide-react';
import Image from 'next/image';
import { Dialog } from 'radix-ui';
import { useId } from 'react';

import overlayStyles from '@/components/overlay/overlay.module.css';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';

import type { ShareRoom } from './api';
import { useCopyPostLink, useShareChoice, useShareDrawer } from './hook';
import styles from './ShareDrawer.module.css';

/**
 * Centered card (max 600 tall): title + ×, room search, my chat rooms (most recent first, team rooms
 * marked "팀") each with its own "공유하기", and "링크 복사하기" at the bottom. Only the list scrolls.
 */
export function ShareDrawer() {
  const { overlay, postId, rooms, search, setSearch, suspended } = useShareDrawer();
  const searchId = useId();

  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayStyles.scrim} />
        <Dialog.Content className={styles.drawer}>
          {/* Title / search / list — Figma 780:585 */}
          <div className={styles.body}>
            <div className={styles.top}>
              <div className={styles.header}>
                <Dialog.Title className={styles.title}>공유하기</Dialog.Title>
                <Dialog.Close className={styles.close}>
                  <X aria-hidden className={styles.closeIcon} />
                  <span className="sr-only">닫기</span>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                게시물을 공유할 채팅방을 골라 주세요.
              </Dialog.Description>

              {/* 검색창 — Figma 780:634 */}
              <div className={styles.search}>
                <label htmlFor={searchId} className="sr-only">
                  채팅방 검색
                </label>
                <Icon svg={MagnifierLinearIcon} className={styles.searchIcon} />
                <input
                  id={searchId}
                  type="search"
                  className={styles.searchInput}
                  placeholder="검색어를 입력해 주세요"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </div>
            </div>

            {postId && (
              <ShareChoices
                key={postId}
                postId={Number(postId)}
                overlay={overlay}
                rooms={rooms}
                suspended={suspended}
              />
            )}
          </div>

          {/* 버튼 - 활성화 — Figma 780:631 */}
          {postId && <CopyLinkButton postId={Number(postId)} overlay={overlay} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type DrawerState = ReturnType<typeof useShareDrawer>;

function ShareChoices({
  postId,
  overlay,
  rooms,
  suspended,
}: {
  postId: number;
  overlay: DrawerState['overlay'];
  rooms: DrawerState['rooms'];
  suspended: boolean;
}) {
  const { send, sendingRoomId, submit } = useShareChoice(postId, overlay);
  const items = rooms.data?.items ?? [];

  return (
    <div className={styles.list}>
      {rooms.isPending ? (
        <p role="status" className={styles.empty}>
          채팅방을 불러오고 있어요.
        </p>
      ) : rooms.isError ? (
        <ErrorState title="채팅방을 불러오지 못했어요" onRetry={() => void rooms.refetch()} />
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          공유할 수 있는 채팅방이 없어요. 팀에 참여하거나 대화를 시작해 보세요.
        </p>
      ) : (
        <ul className={styles.rooms} aria-label="공유할 채팅방">
          {items.map((room) => (
            <RoomRow
              key={room.roomId}
              room={room}
              disabled={suspended || send.isPending}
              busy={sendingRoomId === room.roomId}
              onShare={() => submit(room)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** 리스트 — Figma 800:1339: photo 30, name (+ blue "팀" for team rooms), "공유하기" chip, 1px line under */
function RoomRow({
  room,
  disabled,
  busy,
  onShare,
}: {
  room: ShareRoom;
  disabled: boolean;
  busy: boolean;
  onShare: () => void;
}) {
  return (
    <li className={styles.room}>
      <span className={styles.profile}>
        {room.avatarUrl ? (
          <Image
            src={room.avatarUrl}
            alt=""
            width={30}
            height={30}
            sizes="30px"
            className={styles.avatar}
          />
        ) : (
          <span className={styles.avatar} aria-hidden />
        )}
        <span className={styles.roomName}>
          <span className={styles.roomTitle}>{room.title}</span>
          {room.kind === 'TEAM' && <span className={styles.teamLabel}>팀</span>}
        </span>
      </span>
      <button
        type="button"
        className={styles.share}
        disabled={disabled}
        aria-busy={busy}
        aria-label={`${room.title}에 공유하기`}
        onClick={onShare}
      >
        공유하기
      </button>
    </li>
  );
}

function CopyLinkButton({ postId, overlay }: { postId: number; overlay: DrawerState['overlay'] }) {
  const { copying, copyLink } = useCopyPostLink(postId, overlay);
  return (
    <button
      type="button"
      className={styles.copy}
      disabled={copying}
      onClick={() => void copyLink()}
    >
      링크 복사하기
    </button>
  );
}
