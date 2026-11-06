'use client';

// Overlay: "더보기" — author: edit / close or reopen / delete (borrowed from 20); others: report (00)
import { Flag, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react';
import type { Route } from 'next';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { DeleteConfirmDialog } from '@/components/overlay/delete-confirm-dialog/DeleteConfirmDialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import type { RecruitDetail } from '../../_lib/detail-queries';
import styles from '../detail-sheets.module.css';
import { useRecruitMenuSheet } from './hook';

export function RecruitMenuSheet({ recruit }: { recruit: RecruitDetail }) {
  const {
    menu,
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
                <button type="button" className={styles.menuItem} onClick={openStatus}>
                  {open ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                  {open ? '모집 마감하기' : '다시 모집하기'}
                </button>
              </li>
              <li>
                <button type="button" className={styles.menuItemDanger} onClick={openDelete}>
                  <Trash2 aria-hidden />
                  삭제하기
                </button>
              </li>
            </>
          ) : (
            <li>
              <button type="button" className={styles.menuItem} onClick={openReport}>
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
