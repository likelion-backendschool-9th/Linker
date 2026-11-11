import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  TeamSettingsLoadingActions,
  TeamSettingsPageSkeleton,
} from './_components/team-settings-page-skeleton/TeamSettingsPageSkeleton';

/** Figma 982:746 "9스켈레톤" — stack header, team tabs, member bones, chat FAB. */
export default function TeamSettingsLoading() {
  return (
    <PageFrame
      title="팀 설정"
      variant="stack"
      backHref="/workspace"
      actions={<TeamSettingsLoadingActions />}
    >
      <TeamSettingsPageSkeleton />
    </PageFrame>
  );
}
