import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  PostDetailLoadingActions,
  PostDetailPageSkeleton,
} from './_components/post-detail-page-skeleton/PostDetailPageSkeleton';

/** Figma 999:1090 "23-스켈레톤" — stack header, cover photo + author bones. */
export default function PostDetailLoading() {
  return (
    <PageFrame
      title="게시글 상세"
      variant="stack"
      backHref="/feed"
      actions={<PostDetailLoadingActions />}
    >
      <PostDetailPageSkeleton />
    </PageFrame>
  );
}
