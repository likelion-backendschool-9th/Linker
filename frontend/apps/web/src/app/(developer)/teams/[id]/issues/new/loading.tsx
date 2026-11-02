import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function IssueCreateLoading() {
  return (
    <PageFrame title="이슈 작성">
      <div aria-busy="true">
        <p role="status">이슈 작성 화면을 불러오고 있어요.</p>
        <Skeleton count={2} />
      </div>
    </PageFrame>
  );
}
