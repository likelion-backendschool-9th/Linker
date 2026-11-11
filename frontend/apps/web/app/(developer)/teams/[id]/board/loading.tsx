import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  BoardLoadingActions,
  BoardPageSkeleton,
} from './_components/board-page-skeleton/BoardPageSkeleton';

/** Figma 982:1449 "14-스켈레톤" — stack header, team tabs, filter chrome, column bones. */
export default function BoardLoading() {
  return (
    <PageFrame
      title="상태 보드"
      variant="stack"
      backHref="/workspace"
      actions={<BoardLoadingActions />}
    >
      <BoardPageSkeleton />
    </PageFrame>
  );
}
