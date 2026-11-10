import type { Route } from 'next';
import Link from 'next/link';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { buildMetadata } from '@/lib/seo/metadata';

import { SKELETON_ENTRIES } from './_lib/skeleton-catalog';
import styles from './skeletons.module.css';

export const metadata = buildMetadata({ title: '스켈레톤 미리보기', path: '/test/skeletons' });

/** Dev gallery: open each page's `loading.tsx` skeleton at `/test/skeletons/[page]`. */
export default function SkeletonIndexPage() {
  return (
    <PageFrame title="스켈레톤 미리보기" variant="stack" backHref="/feed">
      <p className={styles.lead}>페이지 번호로 로딩 스켈레톤 UI를 확인합니다.</p>
      <ul className={styles.list}>
        {SKELETON_ENTRIES.map((entry) => (
          <li key={entry.page}>
            <Link href={`/test/skeletons/${entry.page}` as Route} className={styles.link}>
              <span className={styles.page}>{entry.page}</span>
              <span className={styles.name}>{entry.name}</span>
              <span className={styles.path}>{entry.path}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
