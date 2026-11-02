'use client';

// Own region: what follows an acceptance (POL-R-4), shown by the application and role-full sheets
import { useMutation } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { toast } from '@/stores/toast-store';

import { sendGithubInvite, type AcceptResult } from '../_lib/detail-queries';
import styles from './detail-sheets.module.css';

type AcceptedPanelProps = {
  result: AcceptResult;
  applicantId: number;
  applicantName: string;
};

/** Joined the team and its chat; the GitHub org invite is a separate, manual step for the org owner */
export function AcceptedPanel({ result, applicantId, applicantName }: AcceptedPanelProps) {
  const invite = useMutation({
    mutationFn: () => sendGithubInvite(result.teamId, applicantId),
    onSuccess: () => toast('GitHub 조직 초대를 보냈어요.'),
  });
  const inviteError =
    invite.error instanceof ApiError
      ? invite.error.message
      : invite.isError
        ? 'GitHub 조직 초대를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <div className={styles.accepted} role="status">
      <p className={styles.acceptedTitle}>{applicantName}님을 수락했어요</p>
      <p className={styles.hint}>팀원으로 추가되고 팀 채팅에 들어갔어요.</p>
      {result.needsGithubInvite && (
        <>
          <p className={styles.hint}>
            이슈 담당자로 지정하려면 GitHub 조직 초대가 필요해요. 자동으로 보내지 않아요.
          </p>
          <Button
            variant="outline"
            aria-disabled={invite.isPending || invite.isSuccess}
            onClick={() => {
              if (!invite.isPending && !invite.isSuccess) invite.mutate();
            }}
          >
            {invite.isSuccess ? '초대를 보냈어요' : 'GitHub 조직 초대'}
          </Button>
          {inviteError && <p className={styles.error}>{inviteError}</p>}
        </>
      )}
      <Button asChild>
        <Link href={`/chats/${result.chatRoomId}` as Route}>팀 채팅으로 가기</Link>
      </Button>
    </div>
  );
}
