import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <PageFrame title="설정 불러오는 중" variant="stack">
      <section aria-label="설정 불러오는 중">
<LoadingIndicator label="설정 불러오는 중" labelHidden variant="block">
  <Skeleton />
  <Skeleton />
  <Skeleton />
</LoadingIndicator>
</section>
    </PageFrame>
  );
}
