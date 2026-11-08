import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function RecruitDetailLoading() {
  return (
    <PageFrame title="모집 글 상세" variant="stack" backHref="/recruits">
      <div aria-busy="true">
        <p role="status">모집 글을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
