'use client';

// overlay: the "팀 변경" sheet of Figma 7-팀 리스트 (368:1070) and 11 팀 변경 (368:1891)
import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './TeamChangeSheet.module.css';

export type TeamChoice = {
  id: number;
  name: string;
  /** Can't be chosen (e.g. an archived team without a chat room); the reason is read out */
  disabledReason?: string;
};

type TeamChangeSheetProps = {
  overlay: OverlayControl;
  description: string;
  trigger: ReactElement;
  /** `null` while loading or failed: `status` is shown instead of the choices */
  teams: TeamChoice[] | null;
  status?: ReactNode;
  selectedId: number;
  /** Radio group name, unique on the page */
  name: string;
  /** Runs with the chosen team after the button is pressed (the draft lives only in the sheet) */
  onSubmit: (id: number) => unknown;
};

/** Radio list + "팀 변경" button. Choosing a radio is only a draft until the button is pressed. */
export function TeamChangeSheet({
  overlay,
  description,
  trigger,
  teams,
  status,
  selectedId,
  name,
  onSubmit,
}: TeamChangeSheetProps) {
  return (
    <OverlaySheet
      overlay={overlay}
      title="팀 변경"
      description={description}
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
      trigger={trigger}
    >
      {teams ? (
        <TeamChoices teams={teams} selectedId={selectedId} name={name} onSubmit={onSubmit} />
      ) : (
        status
      )}
    </OverlaySheet>
  );
}

function TeamChoices({
  teams,
  selectedId,
  name,
  onSubmit,
}: Pick<TeamChangeSheetProps, 'selectedId' | 'name' | 'onSubmit'> & { teams: TeamChoice[] }) {
  const [draftId, setDraftId] = useState(selectedId);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draftId);
  }

  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">팀 변경</legend>
        {teams.map((team) => (
          <label key={team.id} className={styles.choice}>
            <input
              type="radio"
              name={name}
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
      <button type="submit" className={styles.submit}>
        팀 변경
      </button>
    </form>
  );
}
