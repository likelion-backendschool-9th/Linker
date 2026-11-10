import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { SettingsPageSkeleton } from './_components/settings-page-skeleton/SettingsPageSkeleton';

/** Figma 982:491 "6-스켈레톤" — stack header + account card value bones. */
export default function SettingsLoading() {
  return (
    <PageFrame title="설정" variant="stack" backHref="/feed">
      <SettingsPageSkeleton />
    </PageFrame>
  );
}
