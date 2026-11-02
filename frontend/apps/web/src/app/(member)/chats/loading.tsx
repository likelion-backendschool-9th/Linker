import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatsLoading() {
  return (
    <PageFrame title="채팅">
      <div aria-busy="true">
        <p role="status">채팅 목록을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
