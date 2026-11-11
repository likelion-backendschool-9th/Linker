'use client';

import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { truncateChars } from '@/lib/format/text';
import { RECRUIT } from '@/lib/policy';

import styles from './RecruitCard.module.css';

export type RecruitCardData = {
  id: string;
  href: Route;
  format: string;
  goal: string;
  deadlineLabel: string;
  deadlineFullLabel: string;
  title: string;
  /** The project intro; the card shows its first `RECRUIT.cardIntroPreview` characters (POL-R-2) */
  description?: string;
  roles: string[];
  /** "모집 직군" in the detail panel (Figma 346:573): a single summary value, independent of `roles` */
  recruitingRoleLabel: string;
  techStack: string[];
};

/** 19 recruit list card (Figma 254:2255). "자세히 보기" expand/collapse is scenario 4 (Figma 346:573). */
export function RecruitCard({ recruit }: { recruit: RecruitCardData }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  // One paragraph on the card: the author's line breaks become spaces
  const intro = truncateChars(
    (recruit.description ?? '').replace(/\s+/g, ' '),
    RECRUIT.cardIntroPreview,
  );

  return (
    <article className={styles.card} data-expanded={expanded}>
      <div className={styles.body}>
        <div className={styles.chipRow}>
          <div className={styles.chips}>
            <span className={styles.formatChip}>{recruit.format}</span>
            {recruit.goal ? <span className={styles.goalChip}>{recruit.goal}</span> : null}
          </div>
          <span className={styles.deadline}>{recruit.deadlineLabel}</span>
        </div>
        <div className={styles.textBlock}>
          <h2 className={styles.title}>
            <Link href={recruit.href}>{recruit.title}</Link>
          </h2>
          {intro.text ? (
            <p className={styles.description}>
              {intro.text}
              {intro.truncated && (
                <>
                  ...
                  <Link href={recruit.href} className={styles.more}>
                    자세히 보기
                    <span className="sr-only"> ({recruit.title} 모집글 전체 보기)</span>
                  </Link>
                </>
              )}
            </p>
          ) : null}
        </div>
      </div>
      <div className={styles.meta}>
        <ul className={styles.roles}>
          {recruit.roles.map((role) => (
            <li key={role} className={styles.roleChip}>
              {role}
            </li>
          ))}
        </ul>
        <div className={styles.expandSection}>
          <button
            type="button"
            className={styles.expandButton}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded((open) => !open)}
          >
            자세히 보기
            <Icon svg={AltArrowDownLinearIcon} className={styles.expandIcon} />
          </button>
          <div id={detailId} className={styles.detailWrap} data-expanded={expanded}>
            <div className={styles.detailInner}>
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt>진행 방식</dt>
                  <dd>{recruit.format}</dd>
                </div>
                {recruit.goal ? (
                  <div className={styles.detailRow}>
                    <dt>목적</dt>
                    <dd>{recruit.goal}</dd>
                  </div>
                ) : null}
                <div className={styles.detailRow}>
                  <dt>마감일</dt>
                  <dd>{recruit.deadlineFullLabel}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>모집 직군</dt>
                  <dd>{recruit.recruitingRoleLabel}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>기술 스택</dt>
                  <dd>
                    <ul className={styles.techList}>
                      {recruit.techStack.map((tech) => (
                        <li key={tech}>{tech}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
