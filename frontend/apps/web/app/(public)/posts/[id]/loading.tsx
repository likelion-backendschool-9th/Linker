import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function PostDetailLoading() {
  return (
    <PageFrame title="게시물" variant="stack" backHref="/feed">
      <div aria-busy="true">
        <p role="status">게시물을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
