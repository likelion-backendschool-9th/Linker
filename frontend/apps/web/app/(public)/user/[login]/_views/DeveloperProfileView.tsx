'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, EllipsisVertical, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { ProfileInteractions } from '@/features/profile/profile-interactions/ProfileInteractions';
import { ShareButton } from '@/features/share/share-button/ShareButton';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Role } from '@/lib/auth/route-access';
import type { PublicProfile } from '@/features/profile/profile-types';
import { profileQueryKey } from '@/features/profile/profile-types';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { ContributionCalendar } from '../_components/contribution-calendar/ContributionCalendar';
import { ProfileOutreach } from '../_components/profile-outreach/ProfileOutreach';
import { ProfilePosts } from '../_components/profile-posts/ProfilePosts';
import { ProfileTeams } from '../_components/profile-teams/ProfileTeams';
import { useProfileTeams } from '../_components/profile-teams/hook';
import styles from '../_components/profile.module.css';

export function DeveloperProfileView({
  profile: initialProfile,
  viewerRole,
}: {
  profile: PublicProfile;
  viewerRole: Role;
}) {
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const techSheet = useOverlay('profile-tech');
  const [projectTab, setProjectTab] = useState<'COMPLETED' | 'ACTIVE'>('COMPLETED');
  const { data: profile } = useQuery({
    queryKey: profileQueryKey(initialProfile.login),
    queryFn: () =>
      apiFetch<PublicProfile>(`/api/v1/public/user/${encodeURIComponent(initialProfile.login)}`),
    initialData: initialProfile,
  });
  const teams = useProfileTeams(profile.login);
  const completedCount = teams.data?.items.filter((team) => team.status === 'COMPLETED').length ?? 0;
  const activeCount = teams.data?.items.filter((team) => team.status === 'ACTIVE').length ?? 0;
  const showComposer = viewerRole !== 'recruiter';

  function openComposer() {
    if (!requireLogin('/posts/new')) return;
    router.push('/posts/new');
  }

  return (
    <ProfileInteractions profile={profile} viewerRole={viewerRole}>
      {({ openPeople, showFollow, following, followPending, toggleFollow, showMore, openMore, actionError }) => (
        <article className={styles.stage}>
          <div className={styles.intro}>
            <div className={styles.identityRow}>
              <span className={styles.avatar}>
                {profile.avatarUrl && (
                  <Image src={profile.avatarUrl} alt="" fill sizes="60px" priority />
                )}
              </span>
              <div className={styles.identityText}>
                <div className={styles.nameLine}>
                  <h2 className={styles.displayName}>{profile.name}</h2>
                  {profile.lookingForTeam && <span className={styles.statusBadge}>팀 찾는 중</span>}
                  {profile.jobStatus === 'SEEKING' && <span className={styles.statusBadge}>구직 중</span>}
                  {viewerRole === 'recruiter' && profile.jobStatus === 'OPEN' && (
                    <span className={styles.statusBadge}>제안 받는 중</span>
                  )}
                </div>
                <button type="button" className={styles.followLine} onClick={() => openPeople('followers')}>
                  <span>팔로워 {profile.followerCount}</span>
                  <span>팔로잉 {profile.followingCount}</span>
                </button>
              </div>
              {profile.isMe ? (
                <button type="button" className={styles.chevron} onClick={() => openPeople('followers')}>
                  <ChevronRight aria-hidden />
                  <span className="sr-only">팔로우 목록</span>
                </button>
              ) : (
                showMore && (
                  <button type="button" className={styles.chevron} onClick={openMore}>
                    <EllipsisVertical aria-hidden />
                    <span className="sr-only">더 보기</span>
                  </button>
                )
              )}
            </div>

            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            {safeBlog(profile.blogUrl) && (
              <a className={styles.blog} href={safeBlog(profile.blogUrl)!} target="_blank" rel="noreferrer">
                {profile.blogUrl}
              </a>
            )}

            {profile.techStack.length > 0 && (
              <ul className={styles.stackRow} aria-label="기술 스택">
                {profile.techStack.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
                <li>
                  <button type="button" className={styles.stackMore} onClick={() => techSheet.open()}>
                    <Plus aria-hidden />
                    <span className="sr-only">기술 스택 전체 보기</span>
                  </button>
                </li>
              </ul>
            )}

            <a
              className={profile.isMe ? styles.githubButton : styles.githubButtonQuiet}
              href={profile.githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubMark width={18} height={18} />
              GitHub
            </a>

            <ShareButton
              target={{
                targetType: 'PROFILE',
                targetId: profile.id,
                path: `/user/${profile.login}`,
              }}
            />
            <ProfileOutreach profile={profile} viewerRole={viewerRole} />
            {showFollow && (
              <button
                type="button"
                className={styles.followButton}
                aria-pressed={following}
                aria-busy={followPending}
                onClick={toggleFollow}
              >
                {following ? '팔로잉' : '팔로우'}
              </button>
            )}
            {actionError && (
              <p className={styles.error} role="alert">
                {actionError}
              </p>
            )}
          </div>

          <ContributionCalendar login={profile.login} compact />

          <section className={styles.feed} aria-label="프로젝트">
            <div className={styles.projectTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={projectTab === 'COMPLETED'}
                onClick={() => setProjectTab('COMPLETED')}
              >
                <span>{completedCount}</span>
                완료 프로젝트
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={projectTab === 'ACTIVE'}
                onClick={() => setProjectTab('ACTIVE')}
              >
                <span>{activeCount}</span>
                진행 프로젝트
              </button>
            </div>
            <ProfileTeams login={profile.login} status={projectTab} embedded />
            <ProfilePosts login={profile.login} embedded />
          </section>

          {showComposer && (
            <button type="button" className={styles.fab} onClick={openComposer}>
              <Plus aria-hidden />
              <span className="sr-only">작업물 올리기</span>
            </button>
          )}

          <OverlaySheet
            overlay={techSheet}
            title="기술 스택"
            description="프로필에 표시된 기술 스택입니다."
            describeHidden
          >
            <ul className={styles.techCloud} aria-label="기술 스택">
              {profile.techStack.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <button type="button" className={styles.followButton} onClick={() => techSheet.close()}>
              완료
            </button>
          </OverlaySheet>
        </article>
      )}
    </ProfileInteractions>
  );
}

function safeBlog(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
