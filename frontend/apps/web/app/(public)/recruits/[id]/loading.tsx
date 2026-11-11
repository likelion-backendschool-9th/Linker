import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { RecruitDetailPageSkeleton } from './_components/recruit-detail-page-skeleton/RecruitDetailPageSkeleton';

/** Figma 999:908 "21-스켈레톤" — stack header, chip/title/deadline/intro bones. */
export default function RecruitDetailLoading() {
  return (
    <PageFrame title="모집 글 상세" variant="stack" backHref="/recruits">
      <RecruitDetailPageSkeleton />
    </PageFrame>
  );
}
