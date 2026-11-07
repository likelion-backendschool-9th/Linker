'use client';

import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { readShareCard, shareCardHref } from '@/features/share/chat-cards';

import styles from './SharedContentCard.module.css';

const LABEL = { POST: '게시물', RECRUIT_POST: '모집 글', PROFILE: '프로필' } as const;

export function SharedContentCard({ value }: { value: unknown }) {
  const card = readShareCard(value);
  const href = card && shareCardHref(card);
  if (!card || !href) return <p className={styles.unavailable}>볼 수 없는 게시물이에요</p>;
  return (
    <Link
      href={href as Route}
      prefetch={false}
      className={styles.card}
      aria-label={`${LABEL[card.targetType]}: ${card.title}${card.summary ? `, ${card.summary}` : ''}`}
    >
      {card.imageUrl && (
        <span className={styles.image}>
          <Image src={card.imageUrl} alt="" fill sizes="(max-width: 600px) 65vw, 320px" />
        </span>
      )}
      <span className={styles.body}>
        <span className={styles.label}>{LABEL[card.targetType]}</span>{' '}
        <strong className={styles.title}>{card.title}</strong>{' '}
        {card.summary && <span className={styles.summary}>{card.summary}</span>}
      </span>
    </Link>
  );
}
