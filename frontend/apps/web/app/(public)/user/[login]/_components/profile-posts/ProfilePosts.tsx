'use client';

import Image from 'next/image';
import Link from 'next/link';

import { PostCard } from '@/app/(public)/feed/_components/post-card/PostCard';
import { Button } from '@/components/ui/button/Button';

import styles from '../profile.module.css';
import { useProfilePosts } from './hook';

export function ProfilePosts({ login, embedded = false }: { login: string; embedded?: boolean }) {
  const posts = useProfilePosts(login);

  return (
    <section className={embedded ? styles.embeddedWork : `${styles.section} ${styles.span}`} aria-labelledby="posts-title">
      <h2 id="posts-title" className={embedded ? 'sr-only' : undefined}>
        작업물
      </h2>
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
        <ul className={embedded ? styles.workGrid : styles.postList}>
          {posts.data.items.map((post) => (
            <li key={post.id}>
              {embedded ? (
                <Link className={styles.workCard} href={`/posts/${post.id}?from=profile`}>
                  <span className={styles.workCover}>
                    {post.coverUrl && (
                      <Image src={post.coverUrl} alt="" fill sizes="164px" />
                    )}
                  </span>
                  <span className={styles.workTitle}>{post.intro}</span>
                </Link>
              ) : (
                <PostCard post={post} whyShown={null} from="profile" titleLevel={3} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
