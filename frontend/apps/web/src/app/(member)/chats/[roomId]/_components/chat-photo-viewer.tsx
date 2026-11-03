'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { PhotoViewer } from '@/components/overlay/photo-viewer';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { RoomMessage } from '../_lib/room-api';

type Props = { messages: RoomMessage[] };

/** Keep the message ID in the URL so virtualization and new messages cannot change the photo set. */
export function ChatPhotoViewer({ messages }: Props) {
  const overlay = useOverlay('chat-photo');
  const [messageId, index] = (overlay.id ?? '').split(':');
  const message = messages.find((item) => String(item.id) === messageId);
  const visible = message && !message.deletedAt &&
    message.visibility !== 'HIDDEN' && message.visibility !== 'UNDER_REVIEW';
  const photos = visible ? message.imageUrls.map((src, photoIndex) => ({
    src, alt: `채팅 이미지 ${photoIndex + 1}`,
  })) : [];
  if (!photos.length) {
    return (
      <OverlaySheet overlay={overlay} title="사진을 볼 수 없어요" description="삭제되었거나 현재 대화에서 볼 수 없는 사진이에요." />
    );
  }
  return (
    <PhotoViewer
      overlay={{ ...overlay, id: index ?? '0', open: (next) => overlay.open(`${messageId}:${next ?? '0'}`) }}
      photos={photos}
    />
  );
}
