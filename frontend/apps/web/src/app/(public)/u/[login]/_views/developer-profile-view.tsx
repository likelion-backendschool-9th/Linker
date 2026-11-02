'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';

import { ProfileInteractions } from '@/features/profile/profile-interactions';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Role } from '@/lib/auth/route-access';
import type { PublicProfile } from '@/features/profile/profile-types';
import { profileQueryKey } from '@/features/profile/profile-types';

import { ContributionCalendar } from '../_components/contribution-calendar';
import styles from '../_components/profile.module.css';

export function DeveloperProfileView({
  profile: initialProfile,
  viewerRole,
}: {
  profile: PublicProfile;
  viewerRole: Role;
}) {
  const { data: profile } = useQuery({
    queryKey: profileQueryKey(initialProfile.login),
    queryFn: () =>
      apiFetch<PublicProfile>(`/api/v1/public/users/${encodeURIComponent(initialProfile.login)}`),
    initialData: initialProfile,
  });

  return (
    <article className={styles.profile}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.avatar}>
            <Image src={profile.avatarUrl} alt="" fill sizes="80px" priority />
          </span>
          <div className={styles.identityText}>
            <h2 className={styles.name}>{profile.name}</h2>
            <p className={styles.handle}>@{profile.login}</p>
          </div>
        </div>

        {profile.bio && <p className={styles.description}>{profile.bio}</p>}
        <ul className={styles.badges} aria-label="프로필 상태">
          {profile.lookingForTeam && <li className={styles.badge}>팀 찾는 중</li>}
          {profile.jobStatus === 'SEEKING' && <li className={styles.badge}>구직 중</li>}
          {viewerRole === 'recruiter' && profile.jobStatus === 'OPEN' && (
            <li className={styles.badge}>제안 받는 중</li>
          )}
        </ul>
        {toSafeHttps(profile.blogUrl) && (
          <ul className={styles.links}>
            <li>
              <a href={toSafeHttps(profile.blogUrl)!} target="_blank" rel="noreferrer">
                블로그
              </a>
            </li>
          </ul>
        )}
        <ul className={styles.links}>
          <li>
            <a
              href={`https://github.com/${encodeURIComponent(profile.login)}`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub @{profile.login}
            </a>
          </li>
        </ul>
        {profile.techStack.length > 0 && (
          <ul className={styles.tags} aria-label="기술 스택">
            {profile.techStack.map((tag) => (
              <li className={styles.tag} key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}
        <ProfileInteractions profile={profile} viewerRole={viewerRole} />
      </header>

      <section className={styles.section} aria-labelledby="completion-title">
        <h2 id="completion-title">함께 만든 기록</h2>
        {profile.completion.projectCount === 0 ? (
          <p className={styles.empty}>아직 완료한 프로젝트가 없어요</p>
        ) : (
          <div className={styles.completion}>
            <p>
              <strong>{profile.completion.projectCount}</strong>완료한 프로젝트
            </p>
            <p>
              <strong>{Math.round(profile.completion.issueCompletionRate * 100)}%</strong>담당 이슈
              완료율
            </p>
          </div>
        )}
      </section>

      <ContributionCalendar login={profile.login} />
    </article>
  );
}

function toSafeHttps(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
