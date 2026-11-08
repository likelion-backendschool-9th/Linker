'use client';

import Image from 'next/image';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import { IssueSummaryRow } from '../../../../../_components/issue-summary-row';
import type { IssueRow } from '../../../_lib/issue-queries';
import { issuesOnDay } from '../../_lib/calendar-grid';
import styles from './CalendarDaySheet.module.css';

type CalendarDaySheetProps = { teamId: string; overlay: OverlayControl; issues: IssueRow[] };

/** "9월 12일 이슈" sheet of Figma 368:2753: that day's issues, each opening 12 */
export function CalendarDaySheet({ teamId, overlay, issues }: CalendarDaySheetProps) {
  const day = overlay.id;
  const rows = day ? issuesOnDay(day, issues) : [];
  return (
    <OverlaySheet
      overlay={overlay}
      title={day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 이슈` : '이슈'}
      description="이 날 진행하거나 마감하는 이슈예요."
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      <ul className={styles.list}>
        {rows.map((issue) => (
          <li key={issue.id}>
            <IssueSummaryRow
              teamId={teamId}
              issue={issue}
              compact
              onOpen={(href) => void overlay.closeThen(href)}
              action={<Avatar url={issue.assignees[0]?.avatarUrl} />}
            />
          </li>
        ))}
      </ul>
    </OverlaySheet>
  );
}

// Figma "팀 이미지": 32px circle at the row end (the assignee; the name is read in the row)
function Avatar({ url }: { url: string | undefined }) {
  return (
    <span className={styles.avatar}>{url && <Image src={url} alt="" fill sizes="32px" />}</span>
  );
}
