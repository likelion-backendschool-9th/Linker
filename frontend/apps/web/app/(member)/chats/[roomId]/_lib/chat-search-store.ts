'use client';

import { create } from 'zustand';

type ChatSearchState = {
  openRoomId: number | null;
  open: (roomId: number) => void;
  close: () => void;
};

export const useChatSearchStore = create<ChatSearchState>((set) => ({
  openRoomId: null,
  open: (openRoomId) => set({ openRoomId }),
  close: () => set({ openRoomId: null }),
}));
