'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { NOT_IMPLEMENTED } from './api';

export function useRoomHeaderActions(roomId: number) {
  const info = useOverlay('chat-info');
  return {
    openInfo: () => info.open(String(roomId)),
    // Team chat search is [Included]: the Figma icon stays and says so (user decision 2026-11-09)
    onSearch: () => toast(NOT_IMPLEMENTED, { tone: 'info' }),
  };
}
