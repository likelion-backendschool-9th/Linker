import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function IssueCreateLoading() {
  return (
    <PageFrame title="이슈 작성">
      <LoadingIndicator label="이슈 작성 화면을 불러오고 있어요." variant="block">
        <Skeleton count={2} />
      </LoadingIndicator>
    </PageFrame>
  );
}
