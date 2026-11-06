'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useActiveOverlay } from '@/lib/navigation/use-overlay';

import type { RoomMessage } from '../../_lib/room-api';

type Props = {
  messages: RoomMessage[];
  onRead: (id: number) => void;
  readPosition?: { id: number } | null;
};

export function useMessageTimeline({ messages, onRead, readPosition }: Props) {
  'use no memo'; // TanStack Virtual exposes a mutable virtualizer.
  const root = useRef<HTMLDivElement>(null);
  const restoredPosition = useRef<Props['readPosition']>(null);
  const prior = useRef<{
    first: number | undefined;
    last: number | undefined;
    size: number;
  } | null>(null);
  const readHandler = useRef(onRead);
  useEffect(() => {
    readHandler.current = onRead;
  }, [onRead]);
  const { overlay } = useActiveOverlay();
  const [atBottom, setAtBottom] = useState(true);
  // eslint-disable-next-line react-hooks/incompatible-library -- Required virtualizer stays outside compiler memoization via "use no memo".
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => root.current,
    estimateSize: () => 120,
    overscan: 5,
    getItemKey: (index) => messages[index]?.id ?? index,
  });
  const rows = virtualizer.getVirtualItems();
  const visibleKeys = rows.map((row) => row.key).join(',');
  const totalSize = virtualizer.getTotalSize();
  const renderedCount = rows.length;
  const first = messages[0]?.id;
  const last = messages.at(-1)?.id;
  useLayoutEffect(() => {
    const previous = prior.current;
    const element = root.current;
    if (!element || (messages.length && !renderedCount)) return;
    if (readPosition && restoredPosition.current !== readPosition) {
      const index = messages.findIndex((message) => message.id >= readPosition.id);
      if (index >= 0) {
        restoredPosition.current = readPosition;
        setAtBottom(false);
        virtualizer.scrollToIndex(index, { align: 'start' });
      }
    } else if (previous && previous.first !== first && previous.last === last) {
      element.scrollTop += Math.max(0, totalSize - previous.size);
    } else if (!previous || (atBottom && (previous.last !== last || previous.size !== totalSize))) {
      const offset = Math.max(0, totalSize - element.clientHeight);
      element.scrollTop = offset;
      virtualizer.scrollToOffset(offset);
    }
    prior.current = { first, last, size: totalSize };
  }, [first, last, totalSize, renderedCount, messages.length, atBottom, virtualizer, messages, readPosition]);

  // Only rows intersecting the message viewport while the document is visible count as read.
  useEffect(() => {
    if (!root.current || overlay || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState !== 'visible') return;
        const ids = entries
          .filter((entry) => {
            const viewportHeight = entry.rootBounds?.height ?? entry.boundingClientRect.height;
            const requiredHeight = Math.min(entry.boundingClientRect.height, viewportHeight) / 2;
            return entry.isIntersecting && entry.intersectionRect.height >= requiredHeight;
          })
          .map((entry) => Number((entry.target as HTMLElement).dataset.messageId));
        const newest = Math.max(0, ...ids);
        if (newest) readHandler.current(newest);
      },
      { root: root.current, threshold: [0, 0.5] },
    );
    const observe = () =>
      root.current?.querySelectorAll('[data-message-id]').forEach((node) => observer.observe(node));
    observe();
    const element = root.current;
    // Tall rows may never cross the fixed ratio threshold as they scroll.
    const onScroll = () => {
      observer.disconnect();
      observe();
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        observer.disconnect();
        observe();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [visibleKeys, overlay]);

  return {
    root,
    atBottom,
    setAtBottom,
    virtualizer,
    rows,
    jumpToLatest: () => {
      setAtBottom(true);
      virtualizer.scrollToOffset(virtualizer.getTotalSize());
    },
  };
}
