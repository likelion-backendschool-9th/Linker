'use client';

import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import { SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';

import { useLoaderPresence } from '@/components/ui/page-loading';

import { TeamNav } from '../../../_components/team-nav';
import styles from './TeamSettingsPageSkeleton.module.css';

function MemberRowBone() {
  return (
    <li className={styles.row}>
      <span className={`${styles.bone} ${styles.avatar}`} />
      <div className={styles.text}>
        <span className={`${styles.bone} ${styles.role}`} />
        <span className={`${styles.bone} ${styles.name}`} />
      </div>
    </li>
  );
}

/** Header sliders icon (Figma); disabled until settings data is ready. */
export function TeamSettingsLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="팀 설정" disabled>
      <SlidersHorizontal aria-hidden />
    </button>
  );
}

/** Figma 982:746 "9스켈레톤" — team tabs + member-card bones + chat FAB chrome. */
export function TeamSettingsPageSkeleton() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  useLoaderPresence();

  return (
    <>
      <TeamNav teamId={teamId} />
      <div className={styles.page} aria-busy="true">
        <p className="sr-only" role="status">
          불러오는 중이에요
        </p>
        <section className={styles.section} aria-labelledby="team-settings-skeleton-members">
          <div className={styles.sectionHead}>
            <h2 id="team-settings-skeleton-members" className={styles.sectionTitle}>
              팀원 프로필
            </h2>
            <span className={`${styles.bone} ${styles.count}`} aria-hidden />
          </div>
          <ul className={styles.card} aria-hidden>
            <MemberRowBone />
            <MemberRowBone />
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
