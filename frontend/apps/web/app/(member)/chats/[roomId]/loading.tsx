import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function RoomLoading() {
  return (
    <PageFrame title="채팅방" variant="stack" backHref="/chats">
      <div aria-busy="true">
        <p role="status">대화를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
