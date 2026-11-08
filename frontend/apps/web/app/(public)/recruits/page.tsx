import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitList } from './_components/recruit-list';

export const metadata = buildMetadata({ title: '팀 찾기', path: '/recruits', indexable: true });

/** 19 Recruit post list (07 TODO 19, RecruitmentController) — 마크업 재작업 중 */
export default function RecruitsPage() {
  return (
    <PageFrame title="팀 찾기" hideTitle>
      <RecruitList />
    </PageFrame>
  );
}
