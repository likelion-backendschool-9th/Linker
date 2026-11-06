'use client';

import { useQuery } from '@tanstack/react-query';

import { PostCard } from '@/app/(public)/feed/_components/post-card';
import type { FeedPost } from '@/app/(public)/feed/_lib/feed-queries';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/api-fetch';

import styles from './profile.module.css';

export function ProfilePosts({ login }: { login: string }) {
  const posts = useQuery({
    queryKey: ['profile-posts', login],
    queryFn: () =>
      apiFetch<{ items: FeedPost[] }>(`/api/v1/public/users/${encodeURIComponent(login)}/posts`),
  });

  return (
    <section className={`${styles.section} ${styles.span}`} aria-labelledby="posts-title">
      <h2 id="posts-title">작업물</h2>
      {posts.isPending ? (
        <p role="status">작업물을 불러오고 있어요.</p>
      ) : posts.isError ? (
        <div>
          <p role="alert">작업물을 불러오지 못했어요.</p>
          <Button variant="outline" onClick={() => void posts.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : posts.data.items.length === 0 ? (
        <p className={styles.empty}>아직 올린 작업물이 없어요</p>
      ) : (
        <ul className={styles.postList}>
          {posts.data.items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} whyShown={null} from="profile" titleLevel={3} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
