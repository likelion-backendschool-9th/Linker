'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { PhotoViewer } from '@/components/overlay/photo-viewer/PhotoViewer';

import type { RoomMessage } from '../../_lib/room-api';

import { useChatPhotoViewer } from './hook';

type Props = { messages: RoomMessage[] };

/** Keep the message ID in the URL so virtualization and new messages cannot change the photo set. */
export function ChatPhotoViewer({ messages }: Props) {
  const { overlay, photos, photoOverlay } = useChatPhotoViewer(messages);

  if (!photos.length) {
    return (
      <OverlaySheet
        overlay={overlay}
        title="사진을 볼 수 없어요"
        description="삭제되었거나 현재 대화에서 볼 수 없는 사진이에요."
      />
    );
  }
  return <PhotoViewer overlay={photoOverlay} photos={photos} />;
}
