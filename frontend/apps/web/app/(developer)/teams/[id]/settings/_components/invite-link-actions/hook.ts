'use client';

import { useState } from 'react';

import { isInApp, requestNative } from '@/lib/bridge/native';

export function useInviteLinkActions(code: string) {
  const [notice, setNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [sharing, setSharing] = useState(false);

  const url = () => new URL(`/invite/${encodeURIComponent(code)}`, window.location.origin).href;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setNotice('초대 링크를 복사했어요.');
    } catch {
      setManualUrl(url());
      setNotice('자동으로 복사하지 못했어요. 아래 링크를 선택해 복사해 주세요.');
    }
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    setNotice('');
    try {
      if (isInApp()) {
        const result = await requestNative(
          { type: 'SHARE', title: 'Linker 팀 초대', url: url() },
          { timeoutMs: 0 },
        );
        if (!result.ok) setNotice('공유하지 못했어요. 링크 복사를 이용해 주세요.');
      } else if (navigator.share) await navigator.share({ title: 'Linker 팀 초대', url: url() });
      else await copy();
    } catch (error) {
      if (
        !(
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'AbortError'
        )
      )
        setNotice('공유하지 못했어요. 링크 복사를 이용해 주세요.');
    } finally {
      setSharing(false);
    }
  }

  return { notice, manualUrl, sharing, copy, share };
}
