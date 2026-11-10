'use client';

import type { Route } from 'next';
import Link from 'next/link';

import styles from './PostCard.module.css';
import { useExcerptClamp } from './hook';

/** Excerpt — Figma 92:212: two lines at most; only when it's longer, "…" + "더 보기" end line two */
export function PostExcerpt({ text, href }: { text: string; href: Route }) {
  const { ref, shown, measured } = useExcerptClamp(text);
  const cut = shown !== null && shown !== text;

  return (
    <p ref={ref} className={measured ? styles.excerpt : styles.excerptPending}>
      <span data-excerpt-text aria-hidden={cut || undefined}>
        {shown ?? text}
      </span>
      {/* The full text stays readable for screen readers when the visible copy is cut */}
      {cut && <span className="sr-only">{text}</span>}
      {/* Always in the DOM (hidden until cut) so the measuring copy can include it */}
      <span hidden={!cut} data-excerpt-more>
        {' '}
        <Link href={href} className={styles.more}>
          더 보기
        </Link>
      </span>
    </p>
  );
}
