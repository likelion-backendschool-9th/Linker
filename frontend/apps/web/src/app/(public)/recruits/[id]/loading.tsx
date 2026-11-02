import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecruitDetailLoading() {
  return (
    <PageFrame title="모집 글" variant="stack" backHref="/recruits">
      <LoadingIndicator label="모집 글을 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
