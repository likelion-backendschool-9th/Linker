import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { WorkspacePageSkeleton } from './_components/workspace-page-skeleton/WorkspacePageSkeleton';

/** Figma 982:578 "7-스켈레톤" — tab header, team/issue bones, FAB, bottom tabs. */
export default function WorkspaceLoading() {
  return (
    <PageFrame title="워크스페이스" hideTitle>
      <WorkspacePageSkeleton />
    </PageFrame>
  );
}
