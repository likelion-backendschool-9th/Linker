'use client';

import { useState } from 'react';

import { isInApp, requestNative } from '@/lib/bridge/native';

function inviteUrl(code: string) {
  return new URL(`/invite/${encodeURIComponent(code)}`, window.location.origin).href;
}

async function writeClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

/** Resolve text after the click, without losing the user-gesture clipboard grant. */
async function writeClipboardDeferred(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': text.then((value) => new Blob([value], { type: 'text/plain' })),
      }),
    ]);
    return;
  }
  await writeClipboard(await text);
}

async function writeClipboardFallback(text: string) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  document.body.appendChild(field);
  field.select();
  const ok = document.execCommand('copy');
  field.remove();
  if (!ok) throw new Error('copy failed');
}

export function useInviteLinkActions(code: string) {
  const [notice, setNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [sharing, setSharing] = useState(false);

  const url = (value = code) => inviteUrl(value);

  async function finishCopy(href: string, copied: boolean) {
    if (copied) {
      setManualUrl('');
      setNotice('초대 링크를 복사했어요.');
      return true;
    }
    setManualUrl(href);
    setNotice('자동으로 복사하지 못했어요. 아래 링크를 선택해 복사해 주세요.');
    return false;
  }

  async function copy(value = code) {
    setManualUrl('');
    setNotice('');
    const href = url(value);
    try {
      await writeClipboard(href);
      return finishCopy(href, true);
    } catch {
      try {
        await writeClipboardFallback(href);
        return finishCopy(href, true);
      } catch {
        return finishCopy(href, false);
      }
    }
  }

  /**
   * Create/fetch the invite first, but start the clipboard write in the same
   * user-gesture turn so Chromium/Safari do not reject it after the network await.
   */
  async function copyDeferred(href: Promise<string>) {
    setManualUrl('');
    setNotice('');
    try {
      await writeClipboardDeferred(href);
      return finishCopy(await href, true);
    } catch {
      const value = await href;
      try {
        await writeClipboardFallback(value);
        return finishCopy(value, true);
      } catch {
        return finishCopy(value, false);
      }
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
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ))
        setNotice('공유하지 못했어요. 링크 복사를 이용해 주세요.');
    } finally {
      setSharing(false);
    }
  }

  return { notice, manualUrl, sharing, copy, copyDeferred, share, inviteUrl };
}
