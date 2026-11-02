import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <PageFrame title="설정 불러오는 중" variant="stack">
      <section aria-label="설정 불러오는 중">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </section>
    </PageFrame>
  );
}
