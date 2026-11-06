import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function IssueListLoading() {
  return (
    <PageFrame title="이슈">
      <div aria-busy="true">
        <p role="status">이슈를 불러오고 있어요.</p>
        <Skeleton count={4} />
      </div>
    </PageFrame>
  );
}
