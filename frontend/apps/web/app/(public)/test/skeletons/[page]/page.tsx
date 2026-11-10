import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo/metadata';

import { SKELETON_BY_PAGE, SKELETON_ENTRIES } from '../_lib/skeleton-catalog';
import styles from '../skeletons.module.css';

type Props = { params: Promise<{ page: string }> };

export function generateStaticParams() {
  return SKELETON_ENTRIES.map((entry) => ({ page: entry.page }));
}

export async function generateMetadata({ params }: Props) {
  const { page } = await params;
  const entry = SKELETON_BY_PAGE[page];
  return buildMetadata({
    title: entry ? `${entry.page} ${entry.name} 스켈레톤` : '스켈레톤 미리보기',
    path: `/test/skeletons/${page}`,
  });
}

/** Renders the same PageFrame + skeleton body as that page's `loading.tsx`. */
export default async function SkeletonPreviewPage({ params }: Props) {
  const { page } = await params;
  const entry = SKELETON_BY_PAGE[page];
  if (!entry) notFound();

  return (
    <>
      <div className={styles.banner}>
        <p className={styles.bannerText}>
          {entry.page} · {entry.name} 스켈레톤
        </p>
        <Link href={'/test/skeletons' as Route} className={styles.bannerLink}>
          목록
        </Link>
      </div>
      {entry.render()}
    </>
  );
}
