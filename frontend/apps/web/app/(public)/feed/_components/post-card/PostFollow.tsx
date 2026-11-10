'use client';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { useViewer } from '@/lib/auth/viewer-context';

import styles from './PostCard.module.css';

/**
 * "팔로우" (Figma 92:214) / "팔로잉" (92:259). Guests always see "팔로우" and get the login prompt on
 * press (04 ch. 2: actions need login); the follow mutation itself isn't wired on the card yet.
 * Recruiters can't follow (04 ch. 2), so they don't get the chip at all.
 */
export function PostFollow({ following }: { following: boolean }) {
  const requireLogin = useRequireLogin();
  const { role } = useViewer();
  if (role === 'recruiter') return null;

  return (
    <button
      type="button"
      className={following ? styles.following : styles.follow}
      aria-pressed={following}
      onClick={() => requireLogin()}
    >
      {following ? '팔로잉' : '팔로우'}
    </button>
  );
}
