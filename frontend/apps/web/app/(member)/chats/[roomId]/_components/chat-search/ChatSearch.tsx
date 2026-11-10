'use client';

import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { RoomMessage } from '../../_lib/room-api';
import { useChatSearchStore } from '../../_lib/chat-search-store';
import { searchChatMessages } from './api';
import styles from './ChatSearch.module.css';

type Props = {
  roomId: number;
  /** keyword is the trimmed query that matched, for marking it inside the message */
  onSelect: (message: RoomMessage | null, keyword?: string) => void;
};

const EMPTY_RESULTS: RoomMessage[] = [];

export function ChatSearch({ roomId, onSelect }: Props) {
  const open = useChatSearchStore((state) => state.openRoomId === roomId);
  const close = useChatSearchStore((state) => state.close);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const keyword = query.trim();
  const result = useQuery({
    queryKey: ['chat', roomId, 'search', keyword],
    queryFn: ({ signal }) => searchChatMessages(roomId, keyword, signal),
    enabled: open && keyword.length > 0,
    staleTime: 0,
  });
  const items = result.data?.items ?? EMPTY_RESULTS;

  useEffect(() => {
    onSelect(items[0] ?? null, keyword);
  }, [items, keyword, onSelect]);

  if (!open) return null;

  const select = (next: number) => {
    setIndex(next);
    onSelect(items[next] ?? null, keyword);
  };
  const handleClose = () => {
    setQuery('');
    setIndex(0);
    onSelect(null);
    close();
  };

  return (
    <section className={styles.root} aria-label="대화 검색">
      <label className={styles.field}>
        <span className="sr-only">검색어</span>
        <Search aria-hidden />
        <input
          autoFocus
          type="search"
          value={query}
          placeholder="검색어를 입력해 주세요"
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
        />
      </label>
      {keyword && (
        <div className={styles.navigation} aria-live="polite">
          <span>
            {result.isPending ? '검색 중' : items.length ? `${index + 1}/${items.length}` : '0/0'}
          </span>
          <button
            type="button"
            disabled={index >= items.length - 1}
            onClick={() => select(index + 1)}
          >
            <ChevronUp aria-hidden />
            <span className="sr-only">이전 검색 결과</span>
          </button>
          <button type="button" disabled={index <= 0} onClick={() => select(index - 1)}>
            <ChevronDown aria-hidden />
            <span className="sr-only">다음 검색 결과</span>
          </button>
        </div>
      )}
      <button type="button" className={styles.close} onClick={handleClose}>
        <X aria-hidden />
        <span className="sr-only">검색 닫기</span>
      </button>
      {result.isError && (
        <p role="alert" className={styles.status}>
          검색 결과를 불러오지 못했어요.
        </p>
      )}
      {!result.isPending && keyword && !items.length && !result.isError && (
        <p role="status" className={styles.status}>
          검색 결과가 없어요.
        </p>
      )}
    </section>
  );
}
