'use client';

// Own region: what follows an acceptance (POL-R-4), shown by the role-full sheet after "인원 늘리고 초대"
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';

import type { InviteResult } from '../../_lib/detail-queries';
import styles from '../detail-sheets.module.css';
import { useAcceptedPanel } from './hook';

type AcceptedPanelProps = {
  result: InviteResult;
  applicantId: number;
  applicantName: string;
};

/** Joined the team and its chat; the GitHub org invite was already sent automatically (retry if it failed) */
export function AcceptedPanel({ result, applicantId, applicantName }: AcceptedPanelProps) {
  const { githubSent, retryPending, retryError, retry } = useAcceptedPanel(result, applicantId);

  return (
    <div className={styles.accepted} role="status">
      <p className={styles.acceptedTitle}>{applicantName}님을 초대했어요</p>
      <p className={styles.hint}>팀원으로 추가되고 팀 채팅에 들어갔어요.</p>
      {result.needsGithubInvite &&
        (githubSent ? (
          <p className={styles.hint}>GitHub 조직 초대도 보냈어요.</p>
        ) : (
          <>
            <p className={styles.error}>{retryError ?? 'GitHub 조직 초대는 보내지 못했어요.'}</p>
            <Button variant="outline" aria-disabled={retryPending} onClick={retry}>
              {retryPending ? '보내는 중…' : 'GitHub 조직 초대 다시 보내기'}
            </Button>
          </>
        ))}
      <Button asChild>
        <Link href={`/chats/${result.chatRoomId}` as Route}>팀 채팅으로 가기</Link>
      </Button>
    </div>
  );
}
