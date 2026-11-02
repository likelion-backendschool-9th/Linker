import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecruitEditLoading() {
  return (
    <PageFrame title="모집 글 수정" variant="stack">
      <div aria-busy="true">
        <p role="status">작성 화면을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
