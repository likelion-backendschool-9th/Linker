import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({ title: '홈', path: '/feed', indexable: true });

// Empty feed for the end-of-D2 check (blueprint §1-1). Page 24 (E, D9) builds the real feed here.
export default function FeedPage() {
  return (
    <PageFrame title="홈" hideTitle>
      <EmptyState
        title="아직 볼 글이 없어요."
        description="비슷한 스택의 개발자를 팔로우해 보세요."
      />
    </PageFrame>
  );
}
