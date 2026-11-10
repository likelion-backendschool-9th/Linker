'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

import type { RoomMessage } from '../../_lib/room-api';

export function useChatPhotoViewer(messages: RoomMessage[]) {
  const overlay = useOverlay('chat-photo');
  const [messageId, index] = (overlay.id ?? '').split(':');
  const message = messages.find((item) => String(item.id) === messageId);
  const visible =
    !!message &&
    !message.deletedAt &&
    message.visibility !== 'HIDDEN';
  const photos = visible
    ? message.imageUrls.map((src, photoIndex) => ({
        src,
        alt: `채팅 이미지 ${photoIndex + 1}`,
      }))
    : [];

  return {
    overlay,
    messageId,
    index,
    photos,
    photoOverlay: {
      ...overlay,
      id: index ?? '0',
      open: (next?: string) => overlay.open(`${messageId}:${next ?? '0'}`),
    },
  };
}
