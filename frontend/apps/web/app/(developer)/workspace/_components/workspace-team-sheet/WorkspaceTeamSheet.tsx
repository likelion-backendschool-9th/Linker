'use client';

// Overlay boundary: draft form state is discarded when the shared sheet unmounts.
import { useState, type FormEvent, type ReactElement } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { TeamChoice } from '../../../_components/team-change-sheet/TeamChangeSheet';
import styles from './WorkspaceTeamSheet.module.css';

type WorkspaceTeamSheetProps = {
  overlay: OverlayControl;
  trigger: ReactElement;
  teams: TeamChoice[];
  selectedId: number;
  onSubmit: (id: number) => unknown;
};

/** Page 07 only: Figma 7-팀 리스트 (368:1239). Other team screens keep their existing sheet. */
export function WorkspaceTeamSheet({
  overlay,
  trigger,
  teams,
  selectedId,
  onSubmit,
}: WorkspaceTeamSheetProps) {
  return (
    <OverlaySheet
      overlay={overlay}
      trigger={trigger}
      title="팀 변경"
      description="내 이슈를 확인할 팀을 선택해요."
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      <TeamChoices teams={teams} selectedId={selectedId} onSubmit={onSubmit} />
    </OverlaySheet>
  );
}

function TeamChoices({
  teams,
  selectedId,
  onSubmit,
}: Pick<WorkspaceTeamSheetProps, 'teams' | 'selectedId' | 'onSubmit'>) {
  const [draftId, setDraftId] = useState(selectedId);
  const selected = teams.find((team) => team.id === draftId);
  const canSubmit = selected !== undefined && selected.disabledReason === undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit(draftId);
  }

  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">팀 변경</legend>
        {teams.map((team) => (
          <label key={team.id} className={styles.choice}>
            <input
              type="radio"
              name="workspace-team"
              className={styles.radioInput}
              checked={team.id === draftId}
              disabled={team.disabledReason !== undefined}
              onChange={() => setDraftId(team.id)}
            />
            <span className={styles.radio} aria-hidden />
            <span className={styles.choiceName}>{team.name}</span>
            {team.disabledReason && <span className="sr-only">, {team.disabledReason}</span>}
          </label>
        ))}
      </fieldset>
      <button type="submit" className={styles.submit} disabled={!canSubmit}>
        팀 변경
      </button>
    </form>
  );
}
