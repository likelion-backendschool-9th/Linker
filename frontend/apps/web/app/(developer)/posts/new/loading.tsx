import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { PostWritePageSkeleton } from '../_components/post-editor/post-write-page-skeleton/PostWritePageSkeleton';

/** Figma 999:1015 "22-스켈레톤" — stack header, stepper, repo-step chrome, name bone. */
export default function PostNewLoading() {
  return (
    <PageFrame title="피드 작성" variant="stack" backHref="/feed">
      <PostWritePageSkeleton />
    </PageFrame>
  );
}
