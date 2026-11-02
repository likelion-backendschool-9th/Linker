import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecruitNewLoading() {
  return (
    <PageFrame title="모집 글 쓰기" variant="stack" backHref="/recruits">
      <LoadingIndicator label="작성 화면을 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
