'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useRequireLogin } from '@/features/auth/use-require-login';
import type { PublicProfile } from '@/features/profile/profile-types';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import type { Role } from '@/lib/auth/route-access';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from '../profile.module.css';

const MESSAGE_MAX = 2000;
const OFFER_MAX = 1000;

type DirectResult = { roomId: number | null; kind: 'DIRECT' | 'REQUEST' };
type OfferResult = { roomId: number; status: string };

export function ProfileOutreach({
  profile,
  viewerRole,
}: {
  profile: PublicProfile;
  viewerRole: Role;
}) {
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const messageSheet = useOverlay('profile-message');
  const offerSheet = useOverlay('profile-offer');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canOffer =
    !profile.isMe &&
    viewerRole === 'recruiter' &&
    (profile.jobStatus === 'SEEKING' || profile.jobStatus === 'OPEN');
  const canMessage = !profile.isMe && viewerRole !== 'recruiter';

  async function openMessage() {
    if (!requireLogin()) return;
    setError(null);
    setPending(true);
    try {
      const result = await apiFetch<DirectResult>('/api/v1/user/chat-rooms/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (result.roomId) {
        router.push(`/chats/${result.roomId}` as Route);
        return;
      }
      setDraft('');
      messageSheet.open();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '메시지를 시작하지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<DirectResult>('/api/v1/user/chat-rooms/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, message }),
      });
      if (!result.roomId) {
        setError('메시지를 보내지 못했어요.');
        return;
      }
      await messageSheet.closeThen(`/chats/${result.roomId}` as Route);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '메시지를 보내지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  async function sendOffer() {
    const text = draft.trim();
    if (!text) return;
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<OfferResult>('/api/v1/recruiter/chat-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, text }),
      });
      await offerSheet.closeThen(`/chats/${result.roomId}` as Route);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '채용 제안을 보내지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  if (!canMessage && !canOffer) return null;

  return (
    <>
      {canMessage && (
        <button type="button" className={styles.followButton} disabled={pending} onClick={() => void openMessage()}>
          메시지
        </button>
      )}
      {canOffer && (
        <button
          type="button"
          className={styles.followButton}
          onClick={() => {
            setDraft('');
            setError(null);
            offerSheet.open();
          }}
        >
          채용 제안 보내기
        </button>
      )}
      {error && !messageSheet.isOpen && !offerSheet.isOpen && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <OverlaySheet overlay={messageSheet} title="메시지" description="첫 메시지만 요청으로 보내요.">
        <Composer
          id="profile-message"
          value={draft}
          max={MESSAGE_MAX}
          pending={pending}
          error={error}
          onChange={setDraft}
          onSubmit={() => void sendMessage()}
        />
      </OverlaySheet>
      <OverlaySheet
        overlay={offerSheet}
        title="채용 제안 보내기"
        description="첫 제안 메시지를 보내요. 사진은 보낼 수 없어요."
      >
        <Composer
          id="profile-offer"
          value={draft}
          max={OFFER_MAX}
          pending={pending}
          error={error}
          onChange={setDraft}
          onSubmit={() => void sendOffer()}
        />
      </OverlaySheet>
    </>
  );
}

function Composer({
  id,
  value,
  max,
  pending,
  error,
  onChange,
  onSubmit,
}: {
  id: string;
  value: string;
  max: number;
  pending: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor={id}>
        메시지
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={styles.counter}>
        {value.length}/{max}
      </span>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles.followButton} disabled={pending || value.trim().length === 0}>
        {pending ? '보내는 중…' : '보내기'}
      </button>
    </form>
  );
}
