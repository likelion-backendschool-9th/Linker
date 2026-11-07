import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

export type ShareTargetType = 'POST' | 'RECRUIT_POST' | 'PROFILE';
export type ShareTarget = { targetType: ShareTargetType; targetId: number; path: string };
export type ShareRoom = { roomId: number; kind: 'TEAM' | 'DIRECT'; title: string };

/** WBS P17 contract; share-targets is pending on Spring. No generated operation exists yet. */
export function shareRoomsOptions(login: string | null, search: string) {
  return queryOptions({
    queryKey: ['chat', login, 'share-targets', search],
    staleTime: 0,
    queryFn: ({ signal }) =>
      apiFetch<{ items: ShareRoom[] }>(
        `/api/v1/user/me/share-targets?q=${encodeURIComponent(search)}`,
        { signal, cache: 'no-store' },
      ),
  });
}

export function shareCard(roomId: number, target: ShareTarget, clientMessageId: string) {
  return apiFetch(`/api/v1/user/chat-rooms/${roomId}/share-cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetType: target.targetType,
      targetId: target.targetId,
      clientMessageId,
    }),
  });
}

/** Only public content paths are copied; overlay/filter parameters never escape into a share URL. */
export function publicShareUrl(path: string, origin: string) {
  if (!/^\/(?:posts\/\d+|recruits\/\d+|user\/[\w-]+)$/.test(path)) {
    throw new Error('공유할 주소를 확인해 주세요.');
  }
  const url = new URL(path, origin);
  url.searchParams.set('from', 'share');
  return url.href;
}
