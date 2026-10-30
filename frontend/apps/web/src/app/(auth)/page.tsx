import type { Metadata } from 'next';
import Link from 'next/link';

import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { buildMetadata } from '@/lib/seo/metadata';

import styles from './page.module.css';

export const metadata: Metadata = buildMetadata({
  title: 'Linker — 개발자 팀 찾기와 협업',
  path: '/',
  indexable: true,
});

// Placeholder for 01 Start / login (A, D3); the foundation only needs the route to exist.
export default function StartPage() {
  return (
    <PageFrame title="Linker" variant="stack" bottomTabs={false}>
      <p className={styles.description}>
        함께 만들 팀원을 찾고, GitHub로 협업하고, 완성한 프로젝트를 공유하세요.
      </p>
      <Button asChild variant="soft">
        <Link href="/feed">둘러보기</Link>
      </Button>
    </PageFrame>
  );
}
