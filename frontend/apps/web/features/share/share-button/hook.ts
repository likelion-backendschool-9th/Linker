'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  publicShareUrl,
  shareCard,
  shareRoomsOptions,
  type ShareRoom,
  type ShareTarget,
} from './api';

export function useShareButton(target: ShareTarget) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const share = useOverlay('share');
  const picker = useOverlay('share-room');
  const router = useRouter();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [copying, setCopying] = useState(false);
  const id = `${target.targetType}:${target.targetId}`;
  const picking = picker.isOpen && picker.id === id;
  const control = picking ? picker : share;
  const overlay = {
    ...control,
    isOpen: picking || (share.isOpen && share.id === id),
    open: () => {
      setSearch('');
      send.reset();
      share.open(id);
    },
    onOpenChange: (open: boolean) => {
      if (open) {
        setSearch('');
        send.reset();
        share.open(id);
      } else control.close();
    },
  };
  // Async clipboard/send completion must not pop a sheet the user has already dismissed.
  const active = useRef<{ share: typeof share; picker: typeof picker } | null>({ share, picker });
  useEffect(() => {
    active.current = { share, picker };
    return () => {
      active.current = null;
    };
  });
  const sending = useRef(false);
  const attempt = useRef<{ key: string; clientMessageId: string } | null>(null);
  const send = useMutation({
    retry: false,
    mutationFn: ({ room, clientMessageId }: { room: ShareRoom; clientMessageId: string }) =>
      shareCard(room.roomId, target, clientMessageId),
    onSuccess: async (_message, { room, clientMessageId }) => {
      if (attempt.current?.clientMessageId === clientMessageId) attempt.current = null;
      void client.invalidateQueries({ queryKey: ['chat', viewer.login] });
      const notify = () =>
        toast(`${room.title}에 공유했어요.`, {
          action: {
            label: '채팅방으로 가기',
            onClick: () => router.push(`/chats/${room.roomId}` as Route),
          },
        });
      const current = active.current?.picker;
      if (current?.isOpen && current.id === id) await current.closeAnd(notify);
      else notify();
    },
  });

  async function copyLink() {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(publicShareUrl(target.path, window.location.origin));
      const notify = () => toast('링크를 복사했어요');
      const current = active.current?.share;
      if (current?.isOpen && current.id === id) await current.closeAnd(notify);
      else notify();
    } catch {
      toast('링크를 복사하지 못했어요. 다시 시도해 주세요.', { tone: 'alert' });
    } finally {
      setCopying(false);
    }
  }

  return {
    overlay,
    picking,
    copying,
    copyLink,
    search,
    setSearch,
    send,
    rooms: useQuery({
      ...shareRoomsOptions(viewer.login, search.trim()),
      enabled: picking && viewer.role !== 'guest',
    }),
    suspended: viewer.status === 'SUSPENDED',
    openRooms: () => {
      if (requireLogin()) {
        setSearch('');
        send.reset();
        picker.open(id);
      }
    },
    chooseRoom: (room: ShareRoom) => {
      if (sending.current || viewer.status === 'SUSPENDED') return;
      active.current = { share, picker };
      sending.current = true;
      const key = `${id}:${room.roomId}`;
      // A lost response can follow a successful commit. Retrying must reuse the original ID.
      if (attempt.current?.key !== key)
        attempt.current = { key, clientMessageId: crypto.randomUUID() };
      send.mutate(
        { room, clientMessageId: attempt.current.clientMessageId },
        {
          onSettled: () => {
            sending.current = false;
          },
        },
      );
    },
    error:
      send.error instanceof ApiError
        ? send.error.message
        : '공유하지 못했어요. 다시 시도해 주세요.',
  };
}
