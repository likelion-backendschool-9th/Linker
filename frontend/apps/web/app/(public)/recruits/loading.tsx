import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { RecruitListPageSkeleton } from './_components/recruit-list-page-skeleton/RecruitListPageSkeleton';

/** Figma 999:761 "19-스켈레톤" — app chrome, recruit tabs, count/card bones, write FAB. */
export default function RecruitsLoading() {
  return (
    <PageFrame title="팀 찾기" hideTitle>
      <RecruitListPageSkeleton />
    </PageFrame>
  );
}
