import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { RECRUIT_FORMAT_LABELS, RECRUIT_GOAL_LABELS } from '@/features/recruit/recruit-labels';
import { daysUntil, formatDate } from '@/lib/format/time';

import type { RecruitSummary } from '../../_lib/recruit-list-queries';
import styles from './RecruitCard.module.css';

const MAX_TAGS = 4;

/**
 * One recruit post: D-day, format, goal, title, remaining slots per role, tech stack, author (07 TODO 19).
 * The whole card opens 21 through the title link.
 */
export function RecruitCard({ recruit }: { recruit: RecruitSummary }) {
  const titleId = `recruit-${recruit.id}-title`;
  const shownTags = recruit.techTags.slice(0, MAX_TAGS);
  const hiddenTags = recruit.techTags.length - shownTags.length;

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.badges}>
        <RecruitDeadlineBadge deadline={recruit.deadline} closed={recruit.status === 'CLOSED'} />
        <span className={styles.badge}>
          {RECRUIT_FORMAT_LABELS[recruit.format]}
          {recruit.region && ` · ${recruit.region}`}
        </span>
        {recruit.goal && <span className={styles.badge}>{RECRUIT_GOAL_LABELS[recruit.goal]}</span>}
      </div>

      <h2 id={titleId} className={styles.title}>
        <Link href={`/recruits/${recruit.id}` as Route} className={styles.link}>
          {recruit.title}
        </Link>
      </h2>

      <ul className={styles.roles} aria-label="모집 역할">
        {recruit.roles.map((role) => (
          <li key={role.id} className={role.remaining > 0 ? styles.role : styles.roleFull}>
            <span className={styles.roleName}>{role.name}</span>
            {role.remaining > 0 ? `${role.remaining}명 남음` : '모집 완료'}
          </li>
        ))}
      </ul>

      {shownTags.length > 0 && (
        <ul className={styles.tags} aria-label="기술 스택">
          {shownTags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
          {hiddenTags > 0 && (
            <li className={styles.more}>
              +{hiddenTags}
              <span className="sr-only">개 더 있음</span>
            </li>
          )}
        </ul>
      )}

      <p className={styles.author}>
        <Image
          src={recruit.author.avatarUrl}
          alt=""
          width={24}
          height={24}
          sizes="24px"
          className={styles.avatar}
        />
        <span className={styles.name}>{recruit.author.name}</span>
        <span aria-hidden>·</span>
        <RelativeTime value={recruit.createdAt} />
      </p>
    </article>
  );
}

/** "D-n" until the deadline, "오늘 마감" on the day, "모집 마감" once closed; the date is read out too */
function RecruitDeadlineBadge({ deadline, closed }: { deadline: string; closed: boolean }) {
  const days = daysUntil(deadline);
  if (closed || days < 0) return <span className={styles.closed}>모집 마감</span>;
  return (
    <span className={styles.deadline}>
      {days === 0 ? '오늘 마감' : `D-${days}`}
      <span className="sr-only">
        , <time dateTime={deadline}>{formatDate(deadline)}</time> 마감
      </span>
    </span>
  );
}
