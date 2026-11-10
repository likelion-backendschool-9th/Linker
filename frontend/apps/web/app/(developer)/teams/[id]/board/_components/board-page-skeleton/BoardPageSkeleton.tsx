'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import { SlidersHorizontal } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CSSProperties } from 'react';

import { useLoaderPresence } from '@/components/ui/page-loading';

import { TeamNav } from '../../../_components/team-nav';
import styles from './BoardPageSkeleton.module.css';

/** Figma 14 first two columns: 작업 전 (black) + 진행 중 (blue). */
const COLUMNS = [
  { key: 'TODO', color: 'var(--color-tab-indicator)' },
  { key: 'IN_PROGRESS', color: 'var(--color-progress-active)' },
] as const;

function ToolbarChip({ label }: { label: string }) {
  return (
    <span className={styles.control} aria-hidden>
      {label}
      <span className={styles.chevron} dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }} />
    </span>
  );
}

/** Header team-change icon (Figma); disabled until TeamFrame mounts the switcher. */
export function BoardLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="팀 변경" disabled>
      <SlidersHorizontal aria-hidden />
    </button>
  );
}

/** Figma 982:1449 "14-스켈레톤" — team tabs, filter chrome, column/card bones, chat FAB. */
export function BoardPageSkeleton({ teamId: teamIdProp }: { teamId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const teamId = teamIdProp ?? params.id ?? 'preview';
  useLoaderPresence();

  return (
    <>
      <TeamNav teamId={teamId} />
      <div className={styles.page} aria-busy="true">
        <p className="sr-only" role="status">
          불러오는 중이에요
        </p>
        <div className={styles.toolbar} aria-hidden>
          <ToolbarChip label="필터" />
          <ToolbarChip label="최신순" />
        </div>
        <div className={styles.columns} aria-hidden>
          {COLUMNS.map((column) => (
            <section
              key={column.key}
              className={styles.column}
              style={{ '--column-status-color': column.color } as CSSProperties}
            >
              <div className={styles.columnHead}>
                <span className={`${styles.bone} ${styles.title}`} />
                <Link
                  href={`/teams/${teamId}/issues/new` as Route}
                  className={styles.create}
                  tabIndex={-1}
                >
                  <span
                    className={styles.createIcon}
                    dangerouslySetInnerHTML={{ __html: AddBoldIcon }}
                  />
                  <span className="sr-only">이슈 작성</span>
                </Link>
              </div>
              <span className={`${styles.bone} ${styles.card}`} />
            </section>
          ))}
        </div>
      </div>
      <span className={styles.chat} aria-hidden>
        <span
          className={styles.chatIcon}
          dangerouslySetInnerHTML={{ __html: ChatRoundLineLinearIcon }}
        />
      </span>
    </>
  );
}
