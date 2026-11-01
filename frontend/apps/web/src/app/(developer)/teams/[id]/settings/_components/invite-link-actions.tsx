'use client';

// client boundary: browser/native sharing of an existing link; no invite creation
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isInApp, requestNative } from '@/lib/bridge/native';
import styles from '@/features/teams/team-ui.module.css';

export function InviteLinkActions({ code }: { code: string }) {
  const [notice, setNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
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
    setNotice('');
    try {
      if (isInApp()) {
        const result = await requestNative({ type: 'SHARE', title: 'Linker 팀 초대', url: url() });
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
    }
  }
  return (
    <div className={styles.section}>
      <div className={styles.actions}>
        <Button variant="soft" onClick={() => void share()}>
          공유
        </Button>
        <Button variant="outline" onClick={() => void copy()}>
          링크 복사
        </Button>
      </div>
      {notice && (
        <p role="status" className={styles.description}>
          {notice}
        </p>
      )}
      {manualUrl && (
        <div className={styles.field}>
          <label htmlFor={`invite-url-${code}`}>복사할 초대 링크</label>
          <input
            id={`invite-url-${code}`}
            className={styles.input}
            readOnly
            value={manualUrl}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
    </div>
  );
}
