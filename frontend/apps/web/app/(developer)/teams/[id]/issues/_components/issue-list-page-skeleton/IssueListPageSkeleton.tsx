'use client';

import { ArrowLeftToLineBrokenIcon } from '@solar-icons/static/broken/arrow-left-to-line';
import { CheckBrokenIcon } from '@solar-icons/static/broken/check';
import { CloseBrokenIcon } from '@solar-icons/static/broken/close';
import { LoaderBrokenIcon } from '@solar-icons/static/broken/loader';
import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import { SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';

import { useLoaderPresence } from '@/components/ui/page-loading';

import { TeamNav } from '../../../_components/team-nav';
import styles from './IssueListPageSkeleton.module.css';

/** Same order / icons as IssueProgress cards (Figma 11). */
const CARDS = [
  { key: 'DONE', icon: CheckBrokenIcon, size: 'iconMd' },
  { key: 'IN_PROGRESS', icon: LoaderBrokenIcon, size: 'iconSm' },
  { key: 'BLOCKED', icon: CloseBrokenIcon, size: 'iconXm' },
  { key: 'TODO', icon: ArrowLeftToLineBrokenIcon, size: 'iconMd' },
] as const;

/** Header team-change icon (Figma); disabled until TeamFrame mounts the switcher. */
export function IssueListLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="팀 변경" disabled>
      <SlidersHorizontal aria-hidden />
    </button>
  );
}

/** Figma 982:865 "11-스켈레톤" — team tabs + progress card bones + chat FAB chrome. */
export function IssueListPageSkeleton({ teamId: teamIdProp }: { teamId?: string } = {}) {
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
        <section className={styles.band} aria-labelledby="issue-list-skeleton-title">
          <h2 id="issue-list-skeleton-title" className={styles.title}>
            전체 이슈
          </h2>
          <ul className={styles.cards} aria-hidden>
            {CARDS.map((card) => (
              <li key={card.key} className={styles.card}>
                <span
                  className={`${styles.icon} ${styles[card.size]}`}
                  dangerouslySetInnerHTML={{ __html: card.icon }}
                />
                <span className={styles.bone} />
              </li>
            ))}
          </ul>
        </section>
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
