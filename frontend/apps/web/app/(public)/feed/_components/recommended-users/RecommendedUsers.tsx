'use client';

// Own region: empty feed, 5 developers by my tech stack with follow buttons (04 ch. 4 exceptions)
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import type { RecommendedUser } from '../../_lib/feed-queries';
import styles from '../feed-list/FeedList.module.css';
import { useRecommendedPerson, useRecommendedUsers } from './hook';

export function RecommendedUsers() {
  const users = useRecommendedUsers();

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

function Person({ item }: { item: RecommendedUser }) {
  const { following, followPending, toggleFollow } = useRecommendedPerson(item);

  return (
    <div className={styles.person}>
      <Link href={`/users/${item.user.login}` as Route} className={styles.personLink}>
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
        disabled={followPending}
        onClick={toggleFollow}
      >
        {/* Toggle (blueprint §6-2): the name stays "…팔로우", aria-pressed carries the state */}
        <span aria-hidden>{following ? '팔로잉' : '팔로우'}</span>
        <span className="sr-only">{item.user.name} 팔로우</span>
      </Button>
    </div>
  );
}
