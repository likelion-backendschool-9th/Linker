import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function RecruitNewLoading() {
  return (
    <PageFrame title="모집 글 쓰기" variant="stack" backHref="/recruits">
      <div aria-busy="true">
        <p role="status">작성 화면을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
