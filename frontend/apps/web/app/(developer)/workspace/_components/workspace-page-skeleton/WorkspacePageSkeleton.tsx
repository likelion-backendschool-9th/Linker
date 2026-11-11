'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './WorkspacePageSkeleton.module.css';

/** Figma 982:578 "7-스켈레톤" — tab chrome from PageFrame; team/issue bones + FAB. */
export function WorkspacePageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.workspace} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <section className={styles.section} aria-labelledby="workspace-skeleton-teams">
        <h2 id="workspace-skeleton-teams" className={styles.sectionTitle}>
          팀 목록
        </h2>
        <span className={`${styles.bone} ${styles.teamCard}`} aria-hidden />
      </section>
      <section className={styles.section} aria-hidden>
        <span className={`${styles.bone} ${styles.issueTitle}`} />
        <span className={`${styles.bone} ${styles.issueRow}`} />
      </section>
      <Link href="/teams/new" className={styles.fab}>
        <Icon svg={AddBoldIcon} />
        <span className="sr-only">팀 만들기</span>
      </Link>
    </div>
  );
}
