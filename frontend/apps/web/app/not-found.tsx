import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell/AppShell';
import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';

export const metadata: Metadata = { title: '볼 수 없는 콘텐츠', robots: { index: false } };

/** Deleted, hidden, blocked or nonexistent content, and /admin for non-operators (07 TODO 00). */
export default function NotFound() {
  return (
    <AppShell>
      <PageFrame title="볼 수 없는 콘텐츠" variant="stack" backHref="/feed">
        <EmptyState
          title="삭제되었거나 볼 수 없는 콘텐츠예요"
          action={
            <Button asChild variant="soft">
              <Link href="/feed">홈으로 가기</Link>
            </Button>
          }
        />
      </PageFrame>
    </AppShell>
  );
}
