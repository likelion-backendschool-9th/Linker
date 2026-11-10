'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import Image from 'next/image';
import type { TeamSetupBoardSaved } from '@linker/api/openAPIDefinition.schemas';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import teamStyles from '@/features/teams/team-ui.module.css';
import {
  BOARD_STATUS_COLORS,
  boardStatusColorVar,
  type BoardStatusColor,
} from '@/app/(developer)/_lib/issue-status';
import type { BoardSelection } from '../../../_components/team-board-selection';
import { useTeamSetupBoards } from './hook';
import styles from './TeamSetupBoards.module.css';

const STATUS_OPTIONS = [
  ['TODO', '작업 전 · Todo'],
  ['IN_PROGRESS', '작업 중 · In Progress'],
  ['BLOCKED', '작업 중단 · Blocked'],
  ['DONE', '작업 완료 · Done'],
  ['OTHER', '기타'],
] as const;
// Figma labels are presentation only. NEW uses the server's fixed four Status options.
const NEW_LABELS = ['작업 전', '작업 진행', '작업 완료', '작업 정지'];

type Props = {
  teamId: number | null;
  value: BoardSelection;
  onChange: (selection: BoardSelection) => void;
  onSaved: (board: TeamSetupBoardSaved) => void;
  busy?: boolean;
  completionError?: Error | null;
};

export function TeamSetupBoards({
  teamId,
  value,
  onChange,
  onSaved,
  busy = false,
  completionError,
}: Props) {
  const { boards, selected, mode, ready, save } = useTeamSetupBoards(teamId, value, onSaved);
  return (
    <section className={styles.boards} aria-labelledby="setup-boards-title">
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2 id="setup-boards-title">GitHub 프로젝트 보드를 연결해요</h2>
          <p>Projects 보드를 연결하고 새로 만들 수 있어요</p>
        </div>
        <div className={styles.modes} role="group" aria-label="보드 연결 방식">
          <button
            type="button"
            aria-pressed={mode === 'existing'}
            disabled={busy || save.isPending || (boards.isSuccess && !boards.data.items.length)}
            onClick={() => {
              save.reset();
              onChange({ ...value, mode: 'existing' });
            }}
          >
            기존 보드 사용
          </button>
          <button
            type="button"
            aria-pressed={mode === 'new'}
            disabled={busy || save.isPending}
            onClick={() => {
              save.reset();
              onChange({ ...value, mode: 'new' });
            }}
          >
            새 보드 생성
          </button>
        </div>
        {!teamId ? (
          <EmptyState title="GitHub 조직을 먼저 연결해 주세요." />
        ) : boards.isPending ? (
          <Skeleton variant="line" count={3} />
        ) : boards.isError ? (
          <ErrorState onRetry={() => void boards.refetch()} />
        ) : mode === 'existing' ? (
          <>
            <fieldset className={styles.choices} disabled={busy || save.isPending}>
              <legend className="sr-only">연결할 프로젝트 보드</legend>
              {boards.data.items.map((board) => (
                <label key={board.id} className={styles.choice}>
                  <input
                    className={styles.radioInput}
                    type="radio"
                    name="setup-board"
                    value={board.id}
                    checked={board.id === selected?.id}
                    onChange={() => {
                      save.reset();
                      onChange({ mode: 'existing', boardId: board.id, statusMapping: {} });
                    }}
                  />
                  <span className={styles.radio} aria-hidden="true" />
                  <span className={styles.boardName}>{board.name}</span>
                </label>
              ))}
            </fieldset>
            {selected && (
              <div className={styles.mapping}>
                <p className={teamStyles.description}>
                  {selected.name} · 카드 {selected.cardCount}개
                </p>
                <fieldset className={teamStyles.section} disabled={busy || save.isPending}>
                  <legend className={teamStyles.label}>상태 연결</legend>
                  {selected.statusOptions.map((option) => {
                    // OpenAPI's generated option type predates the server's optional color field.
                    const rawColor = 'color' in option ? option.color : undefined;
                    const color = BOARD_STATUS_COLORS.find((c) => c === rawColor) as
                      BoardStatusColor | undefined;
                    return (
                      <label key={option.id} className={teamStyles.field}>
                        <span className={styles.optionLabel}>
                          {color && (
                            <span
                              className={styles.dot}
                              style={{ backgroundColor: boardStatusColorVar(color) }}
                              aria-hidden="true"
                            />
                          )}
                          {option.name}
                        </span>
                        <select
                          className={teamStyles.select}
                          value={value.statusMapping[option.id] ?? ''}
                          onChange={(event) => {
                            save.reset();
                            onChange({
                              ...value,
                              statusMapping: {
                                ...value.statusMapping,
                                [option.id]: event.target.value,
                              },
                            });
                          }}
                        >
                          <option value="" disabled>
                            Linker 상태를 선택해 주세요
                          </option>
                          {STATUS_OPTIONS.map(([status, label]) => (
                            <option key={status} value={status}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </fieldset>
                <p className={teamStyles.description}>
                  Start date·Due date가 없으면 연결할 때 추가해요. 변경 내용은 아직 저장되지 않아요.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className={styles.newBoard}>
            <button
              className={styles.default}
              type="button"
              disabled={busy || save.isPending}
              onClick={() => {
                save.reset();
                onChange({ mode: 'new', boardId: '', statusMapping: {} });
              }}
            >
              기본 값 사용
            </button>
            <ul className={styles.statuses}>
              {NEW_LABELS.map((label) => (
                <li key={label} className={styles.status}>
                  <span>{label}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled
                    aria-label={`${label} 삭제`}
                  >
                    <Image src="/images/team-setup/remove.svg" alt="" width={24} height={24} />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.add} disabled>
              저장소 추가
              <Icon svg={AddBoldIcon} />
            </button>
          </div>
        )}
        {(save.error || completionError) && (
          <ErrorState title={(save.error ?? completionError)!.message} />
        )}
      </div>
      <button
        type="button"
        className={styles.next}
        disabled={busy || !ready}
        aria-busy={busy || save.isPending}
        onClick={() => {
          if (ready && !busy) {
            if (save.isSuccess) onSaved(save.data);
            else save.mutate();
          }
        }}
      >
        다음
      </button>
    </section>
  );
}
