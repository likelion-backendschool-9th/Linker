'use client';

import { ChatRoundAddOutlineIcon } from '@solar-icons/static/outline/chat-round-add';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Role } from '@/lib/auth/route-access';
import type { PublicProfile } from '@/features/profile/profile-types';

import styles from '../profile.module.css';

type DirectResult = { roomId: number | null; kind: 'DIRECT' | 'REQUEST' };
type RecruiterOffers = {
  items: Array<{ roomId: number; status: string; developer: { login: string } | null }>;
};

export function ProfileChatButton({
  profile,
  viewerRole,
}: {
  profile: PublicProfile;
  viewerRole: Role;
}) {
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openChat() {
    if (!requireLogin()) return;
    setPending(true);
    setError(null);
    try {
      if (viewerRole === 'recruiter') {
        const { items } = await apiFetch<RecruiterOffers>('/api/v1/recruiter/offers');
        const conversation = items.find(
          (offer) => offer.status === 'TALKING' && offer.developer?.login === profile.login,
        );
        if (!conversation) {
          setError('진행 중인 채팅방을 찾지 못했어요.');
          return;
        }
        router.push(`/chats/${conversation.roomId}` as Route);
        return;
      }

      const result = await apiFetch<DirectResult>('/api/v1/user/chat-rooms/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (result.roomId) {
        router.push(`/chats/${result.roomId}` as Route);
        return;
      }
      setError('바로 이동할 수 있는 채팅방이 없어요.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '채팅방을 열지 못했어요. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  if (profile.isMe) return null;

  return (
    <>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button
        type="button"
        className={styles.fab}
        aria-label="채팅방으로 이동"
        disabled={pending}
        aria-busy={pending}
        onClick={() => void openChat()}
      >
        <Icon svg={ChatRoundAddOutlineIcon} />
      </button>
    </>
  );
}
