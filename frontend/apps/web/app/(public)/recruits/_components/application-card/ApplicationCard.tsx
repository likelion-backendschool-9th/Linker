import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';

import type { ApplicationStatus, MyApplication } from '../../_lib/recruit-list-queries';
import cardStyles from '../recruit-card/RecruitCard.module.css';
import styles from './ApplicationCard.module.css';

/** What the applicant sees per status (04 ch. 5 "Application status") */
const STATUS_TEXT: Record<ApplicationStatus, string> = {
  PENDING: '검토 중',
  ACCEPTED: '함께하게 됐어요',
  REJECTED: '이번엔 함께하지 못하게 됐어요',
  EXPIRED: '모집이 끝났어요',
};

type ApplicationCardProps = {
  application: MyApplication;
  /** Pending only: opens the cancel confirm */
  onCancel: () => void;
  disabled: boolean;
};

/** One of my applications (07 TODO 19 "내 지원"): post title → 21, role, status, cancel or team chat */
export function ApplicationCard({ application, onCancel, disabled }: ApplicationCardProps) {
  const { recruit } = application;
  const titleId = `application-${application.id}-title`;

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <p className={styles[application.status]}>{STATUS_TEXT[application.status]}</p>
      <h2 id={titleId} className={cardStyles.title}>
        <Link href={`/recruits/${recruit.id}` as Route} className={styles.link}>
          {recruit.title}
        </Link>
      </h2>
      <p className={styles.meta}>
        지원 역할 <span className={styles.role}>{application.roleName}</span>
        <span aria-hidden> · </span>
        <RelativeTime value={application.appliedAt} /> 지원
      </p>

      {application.status === 'PENDING' && (
        <div className={styles.action}>
          <Button variant="danger" disabled={disabled} onClick={onCancel}>
            지원 취소
            <span className="sr-only">: {recruit.title}</span>
          </Button>
        </div>
      )}
      {application.status === 'ACCEPTED' && application.teamChatRoomId !== null && (
        <div className={styles.action}>
          <Button asChild>
            <Link href={`/chats/${application.teamChatRoomId}` as Route}>
              팀 채팅 바로가기
              <span className="sr-only">: {recruit.title}</span>
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}
