import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function PostDetailLoading() {
  return (
    <PageFrame title="게시물" variant="stack" backHref="/feed">
      <LoadingIndicator label="게시물을 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
