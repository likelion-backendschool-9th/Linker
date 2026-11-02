'use client';

// Own region: empty feed, 5 developers by my tech stack with follow buttons (04 ch. 4 exceptions)
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewer } from '@/lib/auth/viewer-context';
import { toast } from '@/stores/toast-store';

import { recommendedUsersOptions, setFollow, type RecommendedUser } from '../_lib/feed-queries';
import styles from './feed-list.module.css';

export function RecommendedUsers() {
  const viewer = useViewer();
  const users = useQuery(recommendedUsersOptions(viewer.login));

  if (users.isPending) return <Skeleton count={2} />;
  // The empty-state copy above already says what to do; nothing more to show on failure
  if (users.isError || users.data.items.length === 0) return null;

  return (
    <section aria-labelledby="recommended-title" className={styles.recommended}>
      <h2 id="recommended-title" className={styles.recommendedTitle}>
        스택이 비슷한 개발자
      </h2>
      <ul className={styles.people}>
        {users.data.items.map((item) => (
          <li key={item.user.id}>
            <Person item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Follow is applied on screen first and reverted on failure (04 ch. 2) */
function Person({ item }: { item: RecommendedUser }) {
  const [following, setFollowing] = useState(false);
  const follow = useMutation({
    mutationFn: (next: boolean) => setFollow(item.user.login, next),
    onMutate: (next) => setFollowing(next),
    onError: (_error, next) => {
      setFollowing(!next);
      toast('팔로우를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' });
    },
  });

  return (
    <div className={styles.person}>
      <Link href={`/u/${item.user.login}` as Route} className={styles.personLink}>
        <Image
          src={item.user.avatarUrl}
          alt=""
          width={48}
          height={48}
          sizes="48px"
          className={styles.personAvatar}
        />
        <span className={styles.personText}>
          <span className={styles.personName}>{item.user.name}</span>
          <span className={styles.personStack}>{item.techStack.slice(0, 3).join(' · ')}</span>
        </span>
      </Link>
      <Button
        variant={following ? 'outline' : 'primary'}
        aria-pressed={following}
        disabled={follow.isPending}
        onClick={() => follow.mutate(!following)}
      >
        {/* Toggle (blueprint §6-2): the name stays "…팔로우", aria-pressed carries the state */}
        <span aria-hidden>{following ? '팔로잉' : '팔로우'}</span>
        <span className="sr-only">{item.user.name} 팔로우</span>
      </Button>
    </div>
  );
}
