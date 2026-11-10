'use client';

// Own region: "이 레포의 다른 게시물" — teammates' posts for the same repo (07 TODO 23, 04 ch. 4)
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useId } from 'react';

import styles from './SameRepoPosts.module.css';
import { useSameRepoPosts } from './hook';

/** Shown only when another visible post exists; a quiet extra, so loading and errors stay silent */
export function SameRepoPosts({ postId }: { postId: string }) {
  const titleId = useId();
  const { items } = useSameRepoPosts(postId);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h3 id={titleId} className={styles.title}>
        이 레포의 다른 게시물
      </h3>
      <ul className={styles.list}>
        {items.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}` as Route} className={styles.row}>
              {post.coverUrl ? (
                <Image
                  src={post.coverUrl}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className={styles.cover}
                />
              ) : (
                <span className={styles.cover} aria-hidden />
              )}
              <span className={styles.text}>
                <span className={styles.intro}>{post.intro}</span>
                <span className={styles.author}>@{post.author.login}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
