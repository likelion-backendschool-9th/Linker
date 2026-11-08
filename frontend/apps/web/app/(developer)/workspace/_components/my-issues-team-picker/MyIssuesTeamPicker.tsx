'use client';

// overlay: the selected-team card opens the "팀 변경" sheet (Figma 7-팀 리스트)
import type { TeamItem } from '@linker/api/openAPIDefinition.schemas';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { teamEntryHref } from '@/features/teams/team-entry';

import { useMyIssuesTeamForm, useMyIssuesTeamOverlay } from './hook';
import styles from './MyIssuesTeamPicker.module.css';

type MyIssuesTeamPickerProps = {
  teams: TeamItem[];
  selected: TeamItem;
  onSelect: (id: number) => unknown;
};

/** Card body = team picker that only filters my issues; › = B's team entry (11). */
export function MyIssuesTeamPicker({ teams, selected, onSelect }: MyIssuesTeamPickerProps) {
  const overlay = useMyIssuesTeamOverlay();
  const entryHref = teamEntryHref(selected);
  // Figma solar:alt-arrow-left-linear turned 180° (›) or 90° (∨ while the sheet is open)
  const chevron = overlay.isOpen ? AltArrowDownLinearIcon : AltArrowRightLinearIcon;

  return (
    <div className={styles.picker}>
      <h2 className={styles.label}>팀 목록</h2>
      <div className={styles.card}>
        <OverlaySheet
          overlay={overlay}
          title="팀 변경"
          description="내 이슈를 확인할 팀을 선택해요."
          describeHidden
          classNames={{ scrim: styles.sheetScrim, sheet: styles.sheet, title: styles.sheetTitle }}
          trigger={
            <button type="button" className={styles.trigger}>
              <span className="sr-only">팀 변경, 현재 {selected.name}</span>
              <span aria-hidden className={styles.triggerContent}>
                {selected.orgAvatarUrl ? (
                  <Image
                    className={styles.avatar}
                    src={selected.orgAvatarUrl}
                    alt=""
                    width={50}
                    height={50}
                    sizes="50px"
                  />
                ) : (
                  <Users className={styles.avatar} />
                )}
                <span className={styles.summary}>
                  <span className={styles.name}>{selected.name}</span>
                  <span className={styles.members}>멤버 {selected.memberCount}명</span>
                </span>
              </span>
            </button>
          }
        >
          <TeamChoices
            overlay={overlay}
            teams={teams}
            selectedId={selected.id}
            onSelect={onSelect}
          />
        </OverlaySheet>
        {entryHref && (
          <Link href={entryHref} className={styles.entry}>
            <span
              aria-hidden
              className={styles.chevron}
              dangerouslySetInnerHTML={{ __html: chevron }}
            />
            <span className="sr-only">{selected.name} 팀으로 이동</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function TeamChoices({
  overlay,
  teams,
  selectedId,
  onSelect,
}: {
  overlay: ReturnType<typeof useMyIssuesTeamOverlay>;
  teams: TeamItem[];
  selectedId: number;
  onSelect: (id: number) => unknown;
}) {
  const { draftId, setDraftId, submit } = useMyIssuesTeamForm(overlay, selectedId, onSelect);
  return (
    <form onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">팀 변경</legend>
        {teams.map((team) => (
          <label key={team.id} className={styles.choice}>
            <input
              type="radio"
              name="my-issues-team"
              className={styles.radioInput}
              checked={team.id === draftId}
              onChange={() => setDraftId(team.id)}
            />
            <span className={styles.radio} aria-hidden />
            <span className={styles.choiceName}>{team.name}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className={styles.submit}>
        팀 변경
      </button>
    </form>
  );
}
