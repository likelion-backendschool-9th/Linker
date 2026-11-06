'use client';

import { useState } from 'react';

import type { SetupBoard } from '../../_lib/setup-queries';

export type BoardSelection = {
  mode: 'new' | 'existing';
  boardId: string;
  statusMapping: Record<string, string>;
};

const DEFAULT: BoardSelection = {
  mode: 'new',
  boardId: '',
  statusMapping: {},
};

export function useTeamBoardSelection({
  boards,
  value,
  onChange,
}: {
  boards: SetupBoard[];
  value?: BoardSelection;
  onChange?: (selection: BoardSelection) => void;
}) {
  const [local, setLocal] = useState<BoardSelection>(DEFAULT);
  const selection = value ?? local;
  const { mode, boardId } = selection;
  const selected = boards.find((board) => board.id === boardId) ?? boards[0];

  function change(next: BoardSelection) {
    setLocal(next);
    onChange?.(next);
  }

  return { selection, mode, selected, change };
}
