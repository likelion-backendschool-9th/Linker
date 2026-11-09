'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { ProfileInteractions } from '@/features/profile/profile-interactions/ProfileInteractions';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Role } from '@/lib/auth/route-access';
import type { PublicProfile } from '@/features/profile/profile-types';
import { profileQueryKey } from '@/features/profile/profile-types';

import { ProfileChatButton } from '../_components/profile-chat-button/ProfileChatButton';
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
  return (
    <ProfileInteractions profile={profile} viewerRole={viewerRole}>
      {({ openPeople, showFollow, following, followPending, toggleFollow, actionError }) => (
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
              ) : null}
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
            {projectTab === 'COMPLETED' ? (
              <ProfilePosts login={profile.login} embedded />
            ) : (
              <ProfileTeams login={profile.login} status="ACTIVE" embedded />
            )}
          </section>

          {!initialProfile.isMe && <ProfileChatButton profile={profile} viewerRole={viewerRole} />}
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
