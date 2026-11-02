import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function RoomLoading() {
  return (
    <PageFrame title="채팅방" variant="stack" backHref="/chats">
      <LoadingIndicator label="대화를 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
