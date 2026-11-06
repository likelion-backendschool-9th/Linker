'use client';

import { Button } from '@/components/ui/button/Button';
import styles from '@/features/teams/team-ui.module.css';

import { useInviteLinkActions } from './hook';

export function InviteLinkActions({ code }: { code: string }) {
  const { notice, manualUrl, sharing, copy, share } = useInviteLinkActions(code);
  return (
    <div className={styles.section}>
      <div className={styles.actions}>
        <Button variant="soft" disabled={sharing} aria-busy={sharing} onClick={() => void share()}>
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
