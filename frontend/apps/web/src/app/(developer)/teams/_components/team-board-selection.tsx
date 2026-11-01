'use client';

// real reuse: board preview and status mapping in setup and settings
import { useState } from 'react';
import styles from '@/features/teams/team-ui.module.css';
import type { SetupBoard } from '../_lib/setup-queries';

const STATUSES = [
  ['TODO', '작업 전 · Todo'],
  ['IN_PROGRESS', '작업 중 · In Progress'],
  ['BLOCKED', '작업 중단 · Blocked'],
  ['DONE', '작업 완료 · Done'],
] as const;

export type BoardSelection = {
  mode: 'new' | 'existing';
  boardId: string;
  statusMapping: Record<string, string>;
};
export function TeamBoardSelection({
  boards,
  value,
  onChange,
}: {
  boards: SetupBoard[];
  value?: BoardSelection;
  onChange?: (selection: BoardSelection) => void;
}) {
  const [local, setLocal] = useState<BoardSelection>({
    mode: 'new',
    boardId: '',
    statusMapping: {},
  });
  const selection = value ?? local;
  const { mode, boardId } = selection;
  function change(next: BoardSelection) {
    setLocal(next);
    onChange?.(next);
  }
  const selected = boards.find((board) => board.id === boardId) ?? boards[0];
  return (
    <div className={styles.section}>
      <fieldset className={styles.section}>
        <legend className={styles.label}>보드 연결 방식</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name="board-mode"
            checked={mode === 'new'}
            onChange={() => change({ ...selection, mode: 'new' })}
          />
          새로 만들기
        </label>
        <label className={styles.choice}>
          <input
            type="radio"
            name="board-mode"
            checked={mode === 'existing'}
            disabled={!boards.length}
            onChange={() => change({ ...selection, mode: 'existing', boardId: selected?.id ?? '' })}
          />
          기존 보드 쓰기
        </label>
      </fieldset>
      {mode === 'existing' && selected ? (
        <>
          <div className={styles.field}>
            <label htmlFor="existing-board">기존 보드 선택</label>
            <select
              id="existing-board"
              className={styles.select}
              value={selected.id}
              onChange={(event) =>
                change({ ...selection, boardId: event.target.value, statusMapping: {} })
              }
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name} · 카드 {board.cardCount}개
                </option>
              ))}
            </select>
          </div>
          <p className={styles.description}>
            {selected.name} · 카드 {selected.cardCount}개
          </p>
          <fieldset key={selected.id} className={styles.section}>
            <legend className={styles.label}>상태 연결</legend>
            {selected.statusColumns.map((column) => (
              <label className={styles.field} key={column}>
                <span>{column}</span>
                <select
                  className={styles.select}
                  value={selection.statusMapping[column] ?? ''}
                  required
                  onChange={(event) =>
                    change({
                      ...selection,
                      statusMapping: { ...selection.statusMapping, [column]: event.target.value },
                    })
                  }
                >
                  <option value="" disabled>
                    Linker 상태를 선택해 주세요
                  </option>
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <p className={styles.description}>
            Start date·Due date가 없으면 연결할 때 추가해요. 변경 내용은 아직 저장되지 않아요.
          </p>
        </>
      ) : (
        <div className={styles.soft}>
          <h3 className={styles.cardTitle}>Linker</h3>
          <p>Status · Start date · Due date</p>
          <ul className={styles.list}>
            {STATUSES.map(([value, label]) => (
              <li key={value}>{label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
