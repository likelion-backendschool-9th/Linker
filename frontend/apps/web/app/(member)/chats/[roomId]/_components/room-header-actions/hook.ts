'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { useChatSearchStore } from '../../_lib/chat-search-store';

export function useRoomHeaderActions(roomId: number) {
  const info = useOverlay('chat-info');
  const openSearch = useChatSearchStore((state) => state.open);
  return {
    openInfo: () => info.open(String(roomId)),
    onSearch: () => openSearch(roomId),
  };
}
