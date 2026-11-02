import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatsLoading() {
  return (
    <PageFrame title="채팅">
      <LoadingIndicator label="채팅 목록을 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
