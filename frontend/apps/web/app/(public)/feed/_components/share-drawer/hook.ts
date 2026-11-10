'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { publicShareUrl, shareCard, shareRoomsOptions, type ShareRoom } from './api';

/** One drawer for the whole feed; `?overlay=feed-share&oid={postId}` says which post */
export function useShareDrawer() {
  const overlay = useOverlay('feed-share');
  const viewer = useViewer();
  // Partial room name, matched by the server (WBS 17 share-targets `q`)
  const [search, setSearch] = useState('');
  const rooms = useQuery({
    ...shareRoomsOptions(viewer.login, search.trim()),
    enabled: overlay.isOpen && viewer.role !== 'guest',
  });
  return {
    overlay,
    postId: overlay.id,
    rooms,
    search,
    setSearch,
    suspended: viewer.status === 'SUSPENDED',
  };
}

/**
 * A row's "공유하기" sends a post card to that room at once, closes the drawer and shows
 * "○○에 공유했어요." (04 POL-P-7 copy).
 */
export function useShareChoice(postId: number, overlay: OverlayControl) {
  const viewer = useViewer();
  const client = useQueryClient();
  const router = useRouter();
  // A lost response can follow a saved card: a retry to the same room reuses the first id
  const attempt = useRef<{ roomId: number; clientMessageId: string } | null>(null);

  const send = useMutation({
    retry: false,
    mutationFn: ({ room, clientMessageId }: { room: ShareRoom; clientMessageId: string }) =>
      shareCard(
        room.roomId,
        { targetType: 'POST', targetId: postId, path: `/posts/${postId}` },
        clientMessageId,
      ),
    onSuccess: async (_message, { room }) => {
      attempt.current = null;
      void client.invalidateQueries({ queryKey: ['chat', viewer.login] });
      await overlay.closeAnd(() =>
        toast(`${room.title}에 공유했어요.`, {
          action: {
            label: '채팅방으로 가기',
            onClick: () => router.push(`/chats/${room.roomId}` as Route),
          },
        }),
      );
    },
    onError: (error) =>
      toast(
        error instanceof ApiError && error.status < 500
          ? error.message
          : '공유하지 못했어요. 다시 시도해 주세요.',
        { tone: 'alert' },
      ),
  });

  function submit(room: ShareRoom) {
    if (send.isPending || viewer.status === 'SUSPENDED') return;
    if (attempt.current?.roomId !== room.roomId) {
      attempt.current = { roomId: room.roomId, clientMessageId: crypto.randomUUID() };
    }
    send.mutate({ room, clientMessageId: attempt.current.clientMessageId });
  }

  return {
    send,
    sendingRoomId: send.isPending ? (send.variables?.room.roomId ?? null) : null,
    submit,
  };
}

/** "링크 복사하기": the public post URL with `?from=share`, then "링크를 복사했어요" (04 POL-P-7) */
export function useCopyPostLink(postId: number, overlay: OverlayControl) {
  const [copying, setCopying] = useState(false);

  async function copyLink() {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        publicShareUrl(`/posts/${postId}`, window.location.origin),
      );
      await overlay.closeAnd(() => toast('링크를 복사했어요'));
    } catch {
      toast('링크를 복사하지 못했어요. 다시 시도해 주세요.', { tone: 'alert' });
    } finally {
      setCopying(false);
    }
  }

  return { copying, copyLink };
}
