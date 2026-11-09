import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function IssueDetailLoading() {
  return (
    <PageFrame title="이슈 상세" variant="stack">
      <div aria-busy="true">
        <p role="status">이슈를 불러오고 있어요.</p>
        <Skeleton count={2} />
      </div>
    </PageFrame>
  );
}
