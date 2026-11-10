'use client';

// overlay: the selected-team card opens the "팀 변경" sheet (Figma 7-팀 리스트)
import type { TeamItem } from '@linker/api/openAPIDefinition.schemas';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { teamEntryHref } from '@/features/teams/team-entry';

import { TeamChangeSheet } from '../../../_components/team-change-sheet';
import { useMyIssuesTeamOverlay } from './hook';
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
        <TeamChangeSheet
          overlay={overlay}
          description="내 이슈를 확인할 팀을 선택해요."
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
          teams={teams}
          selectedId={selected.id}
          name="my-issues-team"
          // The URL changes after closing: `history.back()` would undo a change made while open
          onSubmit={(id) => void overlay.closeAnd(() => onSelect(id))}
        />
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
