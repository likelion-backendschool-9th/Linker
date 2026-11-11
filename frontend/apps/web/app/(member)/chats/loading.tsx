import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { ChatListPageSkeleton } from './_components/chat-list-page-skeleton/ChatListPageSkeleton';

/** Figma 999:479 "16-스켈레톤" — app chrome, chat tabs, one room row bones. */
export default function ChatsLoading() {
  return (
    <PageFrame title="채팅" hideTitle>
      <ChatListPageSkeleton />
    </PageFrame>
  );
}
