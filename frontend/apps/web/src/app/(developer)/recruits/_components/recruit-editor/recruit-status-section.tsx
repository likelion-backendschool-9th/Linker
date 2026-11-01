'use client';

// Own region: close / reopen / delete on the edit screen (07 TODO 20, also borrowed by 21's menu)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { DeleteConfirmDialog } from '@/components/overlay/delete-confirm-dialog';
import { Button } from '@/components/ui/button';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { closeRecruit, deleteRecruit, reopenRecruit } from '../../_lib/editor-queries';
import styles from './recruit-editor.module.css';

type RecruitStatusSectionProps = {
  recruitId: string;
  status: 'OPEN' | 'CLOSED';
  /** Clears the device draft before leaving */
  onDeleted: () => void;
};

export function RecruitStatusSection({ recruitId, status, onDeleted }: RecruitStatusSectionProps) {
  const router = useRouter();
  const client = useQueryClient();
  const statusDialog = useOverlay('recruit-status');
  const deleteDialog = useOverlay('delete-confirm');
  const open = status === 'OPEN';

  const toggle = useMutation({
    mutationFn: () => (open ? closeRecruit(recruitId) : reopenRecruit(recruitId)),
    onSuccess: async () => {
      statusDialog.close();
      toast(open ? '모집을 마감했어요.' : '다시 모집을 시작했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    // PLAN_LIMIT on reopen opens the shared limit sheet
    onError: () => statusDialog.close(),
  });
  const remove = useMutation({
    mutationFn: () => deleteRecruit(recruitId),
    onSuccess: async () => {
      onDeleted();
      toast('모집 글을 삭제했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
      await deleteDialog.closeAnd(() => router.replace('/recruits?tab=mine' as Route));
    },
  });

  return (
    <section aria-labelledby="recruit-status-title" className={styles.statusSection}>
      <h2 id="recruit-status-title" className={styles.sectionTitle}>
        모집 관리
      </h2>
      <p className={styles.statusText}>
        지금 <strong>{open ? '모집 중' : '마감됨'}</strong>이에요.{' '}
        {open
          ? '마감하면 목록에서 빠지고 새 지원을 받지 않아요.'
          : '다시 모집하면 목록에 보이고 새 지원을 받아요.'}
      </p>
      {(toggle.isError || remove.isError) && (
        <p className={styles.error} role="alert">
          처리하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <div className={styles.statusActions}>
        <Button variant="outline" onClick={() => statusDialog.open()}>
          {open ? '모집 마감하기' : '다시 모집하기'}
        </Button>
        <Button variant="danger" onClick={() => deleteDialog.open(recruitId)}>
          모집 글 삭제
        </Button>
      </div>

      <ConfirmDialog
        overlay={statusDialog}
        title={open ? '모집을 마감할까요?' : '다시 모집할까요?'}
        description={
          open
            ? '목록에서 빠지고 새 지원을 받지 않아요. 검토 중인 지원은 마감한 뒤에도 수락하거나 거절할 수 있어요.'
            : '목록에 다시 보이고 새 지원을 받아요.'
        }
        confirmLabel={open ? '마감하기' : '다시 모집하기'}
        pending={toggle.isPending}
        onConfirm={() => {
          if (!toggle.isPending) toggle.mutate();
        }}
      />
      <DeleteConfirmDialog
        title="모집 글을 삭제할까요?"
        description="검토 중인 지원은 '모집이 끝났어요'로 바뀌고 지원자에게 알림이 가요. 이미 수락한 팀원은 팀에 남아요."
        pending={remove.isPending}
        onConfirm={() => {
          if (!remove.isPending) remove.mutate();
        }}
      />
    </section>
  );
}
