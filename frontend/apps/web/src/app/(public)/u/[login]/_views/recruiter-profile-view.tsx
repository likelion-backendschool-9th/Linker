import Image from 'next/image';

import { ProfileInteractions } from '@/features/profile/profile-interactions';
import type { Role } from '@/lib/auth/route-access';
import type { PublicProfile } from '@/features/profile/profile-types';

import styles from '../_components/profile.module.css';

export function RecruiterProfileView({
  profile,
  viewerRole,
}: {
  profile: PublicProfile;
  viewerRole: Role;
}) {
  return (
    <article className={styles.profile}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.avatar}>
            {profile.avatarUrl && <Image src={profile.avatarUrl} alt="" fill sizes="80px" priority />}
          </span>
          <div className={styles.identityText}>
            <h2 className={styles.name}>{profile.name}</h2>
            {profile.jobTitle && <p className={styles.handle}>{profile.jobTitle}</p>}
          </div>
        </div>
        <dl className={styles.companyDetails}>
          {profile.company && (
            <div>
              <dt>회사</dt>
              <dd>{profile.company}</dd>
            </div>
          )}
          {profile.companyEmailDomain && (
            <div>
              <dt>인증된 회사 이메일</dt>
              <dd>@{profile.companyEmailDomain}</dd>
            </div>
          )}
          {toSafeHttps(profile.websiteUrl) && (
            <div>
              <dt>회사 웹사이트</dt>
              <dd>
                <a href={toSafeHttps(profile.websiteUrl)!} target="_blank" rel="noreferrer">
                  {profile.websiteUrl}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <ProfileInteractions profile={profile} viewerRole={viewerRole} />
      </header>
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
