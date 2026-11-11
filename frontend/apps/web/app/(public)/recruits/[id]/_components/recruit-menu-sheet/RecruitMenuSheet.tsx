'use client';

// App-bar "더보기" dropdown (Figma 92:578 262:88): non-author → 신고/공유; author → 수정/마감·재모집/삭제
import { EllipsisVertical, Flag, Lock, LockOpen, Pencil, Share2, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { DeleteConfirmDialog } from '@/components/overlay/delete-confirm-dialog/DeleteConfirmDialog';
import { ShareButton } from '@/features/share/share-button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { RecruitDetail } from '../../_lib/detail-queries';
import styles from './RecruitMenuSheet.module.css';
import { useRecruitMenuSheet } from './hook';

/** The dropdown ends at the 16px gutter while the header icon box ends 6px from the edge (as on 23) */
const MENU_ALIGN_OFFSET = 10;

export function RecruitMenuSheet({ recruit }: { recruit: RecruitDetail }) {
  const router = useRouter();
  const shareOverlay = useOverlay('share');
  const shareTarget = {
    targetType: 'RECRUIT_POST' as const,
    targetId: recruit.id,
    path: `/recruits/${recruit.id}`,
  };
  const shareId = `RECRUIT_POST:${recruit.id}`;
  const {
    statusDialog,
    open,
    togglePending,
    removePending,
    confirmToggle,
    confirmDelete,
    openStatus,
    openDelete,
    openReport,
  } = useRecruitMenuSheet(recruit);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className={styles.trigger} aria-label="모집 글 더보기">
            <EllipsisVertical aria-hidden className={styles.triggerIcon} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.panel}
            side="bottom"
            align="end"
            alignOffset={MENU_ALIGN_OFFSET}
            sideOffset={5}
            collisionPadding={16}
          >
            {recruit.isAuthor ? (
              <>
                <DropdownMenu.Item
                  className={styles.item}
                  onSelect={() => router.push(`/recruits/${recruit.id}/edit` as Route)}
                >
                  <Pencil aria-hidden />
                  수정하기
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.item} onSelect={openStatus}>
                  {open ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                  {open ? '모집 마감하기' : '다시 모집하기'}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`${styles.item} ${styles.itemDanger}`}
                  onSelect={openDelete}
                >
                  <Trash2 aria-hidden />
                  삭제하기
                </DropdownMenu.Item>
              </>
            ) : (
              <>
                <DropdownMenu.Item className={styles.item} onSelect={openReport}>
                  <Flag aria-hidden />
                  신고하기
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={styles.item}
                  onSelect={() => shareOverlay.open(shareId)}
                >
                  <Share2 aria-hidden />
                  공유하기
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {!recruit.isAuthor && <ShareButton target={shareTarget} trigger={null} />}

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
            pending={togglePending}
            onConfirm={confirmToggle}
          />
          <DeleteConfirmDialog
            title="모집 글을 삭제할까요?"
            description="검토 중인 지원은 '모집이 끝났어요'로 바뀌고 지원자에게 알림이 가요. 이미 수락한 팀원은 팀에 남아요."
            pending={removePending}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </>
  );
}
