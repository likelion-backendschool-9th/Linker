import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { buildMetadata } from '@/lib/seo/metadata';

import { LoadingTest } from './_components/loading-test';

export const metadata: Metadata = buildMetadata({ title: '로딩 테스트' });

/** Dev-only playground for the loading / load-timeout screens (Figma 301:294, 301:326). 404 in production. */
export default function TestPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <PageFrame title="로딩 테스트" variant="stack" backHref="/feed">
      <LoadingTest />
    </PageFrame>
  );
}
