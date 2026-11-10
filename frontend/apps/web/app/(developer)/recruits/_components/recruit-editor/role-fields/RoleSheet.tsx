'use client';

// "역할 추가" bottom sheet (Figma 525:294): plain single-select list, confirmed with "완료"
import { useState, type FormEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { RECRUIT_ROLE_LABELS, type RecruitRoleKey } from '@/features/recruit/recruit-labels';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './RoleSheet.module.css';

type RoleSheetProps = {
  overlay: OverlayControl;
  /** Roles not already added to the form; each role can only be added once */
  roles: RecruitRoleKey[];
  onSelect: (role: RecruitRoleKey) => void;
};

export function RoleSheet({ overlay, roles, onSelect }: RoleSheetProps) {
  return (
    <OverlaySheet
      overlay={overlay}
      title="모집 역할"
      description="추가할 역할을 하나 골라 주세요."
      describeHidden
    >
      {overlay.isOpen && <RoleChoices roles={roles} onSelect={onSelect} overlay={overlay} />}
    </OverlaySheet>
  );
}

function RoleChoices({
  roles,
  onSelect,
  overlay,
}: Pick<RoleSheetProps, 'roles' | 'onSelect'> & { overlay: OverlayControl }) {
  const [draft, setDraft] = useState<RecruitRoleKey | null>(roles[0] ?? null);

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals this form out of the DOM tree, but React still bubbles the synthetic submit
    // event up the component tree to the outer recruit-editor <form> — stop it there so adding a
    // role never submits the whole editor early.
    event.stopPropagation();
    if (draft) {
      onSelect(draft);
      overlay.close();
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">모집 역할</legend>
        {roles.map((role) => (
          <label key={role} className={styles.choice}>
            <input
              type="radio"
              name="recruit-role"
              className={styles.radioInput}
              checked={role === draft}
              onChange={() => setDraft(role)}
            />
            {RECRUIT_ROLE_LABELS[role]}
          </label>
        ))}
      </fieldset>
      <button type="submit" className={styles.submit} disabled={!draft}>
        완료
      </button>
    </form>
  );
}
