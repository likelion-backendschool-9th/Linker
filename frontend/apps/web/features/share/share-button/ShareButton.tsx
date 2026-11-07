'use client';

import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';

import type { ShareTarget } from './api';
import { useShareButton } from './hook';
import styles from './ShareButton.module.css';

/** Shared by public posts, recruitment posts and developer profiles (POL-P-7). */
export function ShareButton({ target }: { target: ShareTarget }) {
  const state = useShareButton(target);
  const { overlay, picking, rooms, send } = state;
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (picking) searchInput.current?.focus();
  }, [picking]);

  return (
    <OverlaySheet
      overlay={overlay}
      onOpenAutoFocus={(event) => {
        if (picking) {
          event.preventDefault();
          searchInput.current?.focus();
        }
      }}
      title={picking ? '채팅방에 공유' : '공유'}
      description={
        picking
          ? '공유할 채팅방을 선택하면 바로 보내요.'
          : '링크를 복사하거나 채팅방에 공유해 보세요.'
      }
      trigger={
        <button type="button" className={styles.trigger}>
          <Share2 aria-hidden />
          공유
        </button>
      }
    >
      {picking ? (
        <div className={styles.picker}>
          <label className={styles.label} htmlFor="share-room-search">
            채팅방 이름
          </label>
          <input
            id="share-room-search"
            type="search"
            className={styles.search}
            ref={searchInput}
            value={state.search}
            onChange={(event) => state.setSearch(event.target.value)}
          />
          {rooms.isPending && <p role="status">채팅방을 불러오고 있어요.</p>}
          {rooms.isError && (
            <div role="alert">
              <p>채팅방을 불러오지 못했어요.</p>
              <Button variant="outline" onClick={() => void rooms.refetch()}>
                다시 시도
              </Button>
            </div>
          )}
          {rooms.data?.items.length === 0 && (
            <p role="status">
              {state.search.trim()
                ? '검색한 채팅방이 없어요.'
                : '공유할 수 있는 채팅방이 없어요. 팀에 참여하거나 대화를 시작해 보세요.'}
            </p>
          )}
          {state.suspended && <p role="status">이용 제한 중에는 공유할 수 없어요.</p>}
          <ul
            className={styles.list}
            aria-label="공유할 채팅방"
            aria-busy={rooms.isFetching || send.isPending}
          >
            {rooms.data?.items.map((room) => (
              <li key={room.roomId}>
                <button
                  type="button"
                  className={styles.room}
                  disabled={send.isPending || state.suspended}
                  aria-label={`${room.title} ${room.kind === 'TEAM' ? '팀' : '개인'} 채팅방에 공유`}
                  onClick={() => state.chooseRoom(room)}
                >
                  <MessageCircle aria-hidden />
                  <span>{room.title}</span>{' '}
                  <span className={styles.kind}>{room.kind === 'TEAM' ? '팀' : '개인'}</span>
                </button>
              </li>
            ))}
          </ul>
          {send.isPending && <p role="status">공유하고 있어요.</p>}
          {send.isError && <p role="alert">{state.error}</p>}
        </div>
      ) : (
        <div className={styles.options}>
          <button
            type="button"
            className={styles.room}
            disabled={state.copying}
            onClick={() => void state.copyLink()}
          >
            <Copy aria-hidden />
            링크 복사
          </button>
          <button type="button" className={styles.room} onClick={state.openRooms}>
            <MessageCircle aria-hidden />
            채팅방에 공유
          </button>
        </div>
      )}
    </OverlaySheet>
  );
}
