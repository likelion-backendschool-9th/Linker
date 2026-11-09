import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import type { PublicProfile } from '@/features/profile/profile-types';

import { DeveloperProfileForm } from './_views/DeveloperProfileForm';
import { RecruiterProfileForm } from './_views/RecruiterProfileForm';
import type { DeveloperProfileValues, RecruiterProfileValues } from './_lib/form-types';

type JobCategory = { key: string; label: string };
type TechTag = { id: number; name: string };

export const metadata: Metadata = buildMetadata({
  title: '프로필 수정',
  path: '/settings/profile',
});

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ overlay?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/feed');
  const { overlay } = await searchParams;
  if (overlay === 'profile-edit-job') redirect('/settings?overlay=profile-edit-job');

  let avatarUrl: string | null = null;
  try {
    const profile = await apiFetch<PublicProfile>(
      `/api/v1/public/user/${encodeURIComponent(session.login)}`,
    );
    avatarUrl = profile.avatarUrl;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  if (session.userType === 'RECRUITER') {
    const initial = await apiFetch<RecruiterProfileValues>('/api/v1/recruiter/me/profile');
    return (
      <PageFrame title="프로필 수정" variant="stack" backHref={`/user/${session.login}` as Route}>
        <RecruiterProfileForm initial={initial} login={session.login} avatarUrl={avatarUrl} />
      </PageFrame>
    );
  }

  const [initial, techTags, jobCategories] = await Promise.all([
    apiFetch<DeveloperProfileValues>('/api/v1/user/me/profile'),
    apiFetch<TechTag[]>('/api/v1/public/tech-tags'),
    apiFetch<JobCategory[]>('/api/v1/public/job-categories'),
  ]);

  return (
    <PageFrame title="프로필 수정" variant="stack" backHref={`/user/${session.login}` as Route}>
      <DeveloperProfileForm
        initial={initial}
        login={session.login}
        avatarUrl={avatarUrl}
        techTags={techTags}
        jobCategories={jobCategories}
      />
    </PageFrame>
  );
}
