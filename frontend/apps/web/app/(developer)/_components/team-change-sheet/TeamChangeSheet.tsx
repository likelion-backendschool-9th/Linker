'use client';

// overlay: the "팀 변경" sheet of Figma 7-팀 리스트 (368:1070) and 11 팀 변경 (368:1891);
// 22 reuses the same look as "저장소 변경" (676:836)
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
  /** Sheet title and legend; defaults to "팀 변경" */
  title?: string;
  /** Button label; defaults to "팀 변경" */
  submitLabel?: string;
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
  title = '팀 변경',
  submitLabel = '팀 변경',
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
      title={title}
      description={description}
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
      trigger={trigger}
    >
      {teams ? (
        <TeamChoices
          teams={teams}
          selectedId={selectedId}
          name={name}
          title={title}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
        />
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
  title,
  submitLabel,
  onSubmit,
}: Pick<TeamChangeSheetProps, 'selectedId' | 'name' | 'onSubmit'> & {
  teams: TeamChoice[];
  title: string;
  submitLabel: string;
}) {
  const [draftId, setDraftId] = useState(selectedId);

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals this form, but React still bubbles submit to a page <form> around the trigger
    event.stopPropagation();
    onSubmit(draftId);
  }

  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">{title}</legend>
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
        {submitLabel}
      </button>
    </form>
  );
}
