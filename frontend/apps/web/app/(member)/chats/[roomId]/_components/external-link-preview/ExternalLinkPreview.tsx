'use client';

import Image from 'next/image';
import { useExternalLinkPreview } from './hook';
import styles from '../shared-content-card/SharedContentCard.module.css';

export function ExternalLinkPreview({ roomId, text }: { roomId: number; text: string }) {
  const { url, preview, openExternal } = useExternalLinkPreview(roomId, text);
  const data = preview.data;
  // A denied/unavailable OG preview must never prevent reading the original message.
  if (!url || !data || preview.isError) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      onClick={(event) => {
        event.preventDefault();
        openExternal(url);
      }}
    >
      {data.imageUrl?.startsWith('https://') && (
        <span className={styles.image}>
          <Image
            src={data.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 600px) 65vw, 320px"
          />
        </span>
      )}
      <span className={styles.body}>
        <strong className={styles.title}>{data.title || new URL(url).hostname}</strong>
        {data.description && <span className={styles.summary}>{data.description}</span>}
        <span className={styles.label}>외부 링크 · 새 창</span>
      </span>
    </a>
  );
}
