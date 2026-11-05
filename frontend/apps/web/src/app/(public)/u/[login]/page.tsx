import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api/api-error';
import { getSession, viewerFromSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { DeveloperProfileView } from './_views/developer-profile-view';
import { RecruiterMyPageView } from './_views/recruiter-my-page-view';
import { RecruiterProfileView } from './_views/recruiter-profile-view';
import { getPublicProfile } from './_lib/get-profile';

const HIDDEN_PROFILE = '볼 수 없는 프로필';

async function loadProfile(login: string) {
  try {
    const profile = await getPublicProfile(login);
    if (profile.isBlockedByMe) return null;
    if (profile.redirectedFrom && profile.login !== login) {
      permanentRedirect(`/u/${encodeURIComponent(profile.login)}`);
    }
    return profile;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (error.message === HIDDEN_PROFILE) return null;
      notFound();
    }
    throw error;
  }
}

type ProfileRouteProps = { params: Promise<{ login: string }> };

export async function generateMetadata({ params }: ProfileRouteProps): Promise<Metadata> {
  const { login } = await params;
  const profile = await loadProfile(login);
  if (!profile) {
    return buildMetadata({
      title: HIDDEN_PROFILE,
      description: HIDDEN_PROFILE,
      path: `/u/${login}`,
    });
  }
  const isDeveloper = profile.kind === 'DEVELOPER';
  const topStack = profile.techStack.slice(0, 3).join(' · ');
  const title = isDeveloper
    ? `${profile.name} (@${profile.login})${topStack ? ` · ${topStack}` : ''}`
    : `${profile.name} · ${profile.company ?? '채용 담당자'}`;
  const description = isDeveloper
    ? (profile.bio ?? `${profile.name}님의 Linker 개발자 프로필`)
    : `${profile.company ?? ''} ${profile.name} · ${profile.jobTitle ?? '채용 담당자'}`.trim();

  return buildMetadata({
    title,
    description,
    path: `/u/${profile.login}`,
    indexable: isDeveloper,
  });
}

export default async function ProfilePage({ params }: ProfileRouteProps) {
  const { login } = await params;
  const [profile, session] = await Promise.all([loadProfile(login), getSession()]);
  if (!profile) {
    return (
      <PageFrame title={HIDDEN_PROFILE}>
        <EmptyState title={HIDDEN_PROFILE} />
      </PageFrame>
    );
  }
  const viewerRole = viewerFromSession(session).role;

  return (
    <PageFrame title={profile.isMe ? '내 프로필' : profile.name}>
      {profile.kind === 'DEVELOPER' ? (
        <DeveloperProfileView profile={profile} viewerRole={viewerRole} />
      ) : profile.isMe ? (
        <RecruiterMyPageView profile={profile} />
      ) : (
        <RecruiterProfileView profile={profile} viewerRole={viewerRole} />
      )}
    </PageFrame>
  );
}
