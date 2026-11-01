'use client';

// Overlay: "더보기" — author: edit / close or reopen / delete (borrowed from 20); others: report (00)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { DeleteConfirmDialog } from '@/components/overlay/delete-confirm-dialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { closeRecruit, deleteRecruit, reopenRecruit } from '@/features/recruit/recruit-status-api';
import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { RecruitDetail } from '../_lib/detail-queries';
import styles from './detail-sheets.module.css';

export function RecruitMenuSheet({ recruit }: { recruit: RecruitDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const requireLogin = useRequireLogin();
  const menu = useOverlay('recruit-menu');
  const statusDialog = useOverlay('recruit-status');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');
  const open = recruit.status === 'OPEN';

  const toggle = useMutation({
    mutationFn: () => (open ? closeRecruit(recruit.id) : reopenRecruit(recruit.id)),
    onSuccess: async () => {
      statusDialog.close();
      toast(open ? '모집을 마감했어요.' : '다시 모집을 시작했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    // PLAN_LIMIT on reopen opens the shared limit sheet
    onError: () => statusDialog.close(),
  });
  const remove = useMutation({
    mutationFn: () => deleteRecruit(recruit.id),
    onSuccess: async () => {
      toast('모집 글을 삭제했어요.');
      await deleteDialog.closeAnd(() => router.replace('/recruits?tab=mine' as Route));
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

  return (
    <>
      <OverlaySheet
        overlay={menu}
        title="더보기"
        description="이 모집 글에 할 수 있는 일이에요."
        describeHidden
      >
        <ul className={styles.menu}>
          {recruit.isAuthor ? (
            <>
              <li>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => void menu.closeThen(`/recruits/${recruit.id}/edit` as Route)}
                >
                  <Pencil aria-hidden />
                  수정하기
                </button>
              </li>
              <li>
                {/* Opening another overlay replaces this one in the URL (blueprint ch. 7) */}
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => statusDialog.open()}
                >
                  {open ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                  {open ? '모집 마감하기' : '다시 모집하기'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.menuItemDanger}
                  onClick={() => deleteDialog.open(String(recruit.id))}
                >
                  <Trash2 aria-hidden />
                  삭제하기
                </button>
              </li>
            </>
          ) : (
            <li>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  if (!requireLogin()) return;
                  report.open(reportTargetId('RECRUIT_POST', recruit.id));
                }}
              >
                <Flag aria-hidden />
                신고하기
              </button>
            </li>
          )}
        </ul>
      </OverlaySheet>

      {recruit.isAuthor && (
        <>
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
        </>
      )}
    </>
  );
}
