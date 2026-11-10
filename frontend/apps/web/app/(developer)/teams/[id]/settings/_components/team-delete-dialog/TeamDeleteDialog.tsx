'use client';

import { X } from 'lucide-react';
import { AlertDialog } from 'radix-ui';
import overlayStyles from '@/components/overlay/overlay.module.css';
import promptStyles from '@/components/overlay/prompt-dialog.module.css';
import teamStyles from '@/features/teams/team-ui.module.css';
import viewStyles from '../team-settings-view/TeamSettingsView.module.css';
import type { TeamSettings } from './api';
import { useTeamDeleteDialog } from './hook';

/** Keep the final centered confirmation chrome; the existing deletion policy requires typed consent. */
export function TeamDeleteDialog({ team }: { team: TeamSettings }) {
  const { overlay, onOpenChange, confirmName, setConfirmName, canDelete, canConfirm, mutation } =
    useTeamDeleteDialog(team);
  return (
    <AlertDialog.Root open={overlay.isOpen} onOpenChange={onOpenChange}>
      {(team.myRole === 'OWNER' || team.permissions.deleteTeam) && (
        <div className={viewStyles.deleteWrap}>
          <AlertDialog.Trigger asChild>
            <button type="button" className={viewStyles.delete} disabled={!canDelete}>
              팀 삭제
            </button>
          </AlertDialog.Trigger>
        </div>
      )}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayStyles.scrim} />
        <AlertDialog.Content className={promptStyles.dialog}>
          <div className={promptStyles.header}>
            <AlertDialog.Title className={promptStyles.title}>팀 삭제</AlertDialog.Title>
            <AlertDialog.Cancel type="button" className={promptStyles.close}>
              <X aria-hidden className={promptStyles.closeIcon} strokeWidth={2} />
              <span className="sr-only">닫기</span>
            </AlertDialog.Cancel>
          </div>
          <AlertDialog.Description className={promptStyles.description}>
            {canDelete
              ? '해당 팀을 삭제하시겠습니까? 한번 팀을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?'
              : '현재 역할이나 팀 상태에서는 변경할 수 없어요.'}
          </AlertDialog.Description>
          {canDelete && (
            <div className={`${teamStyles.field} ${promptStyles.description}`}>
              <label htmlFor="team-delete-confirm-name">확인을 위해 팀 이름을 입력해 주세요</label>
              <input
                id="team-delete-confirm-name"
                className={teamStyles.input}
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                placeholder={team.name}
                autoComplete="off"
                spellCheck={false}
                disabled={mutation.isPending}
                aria-invalid={mutation.isError}
                aria-describedby={mutation.isError ? 'team-delete-error' : undefined}
              />
            </div>
          )}
          {mutation.isError && (
            <p id="team-delete-error" role="alert" className={promptStyles.error}>
              {mutation.error.message}
            </p>
          )}
          <div className={promptStyles.actions}>
            {canDelete && (
              <button
                type="button"
                className={promptStyles.confirm}
                disabled={!canConfirm}
                aria-disabled={!canConfirm}
                aria-busy={mutation.isPending}
                onClick={() => canConfirm && mutation.mutate(confirmName)}
              >
                삭제하기
              </button>
            )}
            <AlertDialog.Cancel type="button" className={promptStyles.cancel}>
              취소하기
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
