import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { ProfilePageSkeleton } from './_components/profile-page-skeleton/ProfilePageSkeleton';

/** Figma 982:366 "4-스켈레톤" — stack header, identity/bio bones, bottom tabs. */
export default function ProfileLoading() {
  return (
    <PageFrame title="내 프로필" variant="stack" backHref="/feed" bottomTabs>
      <ProfilePageSkeleton />
    </PageFrame>
  );
}
