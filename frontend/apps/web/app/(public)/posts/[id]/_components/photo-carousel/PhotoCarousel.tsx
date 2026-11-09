'use client';

// Own region: swipeable photos with buttons and the full-screen viewer (07 TODO 23)
import Image from 'next/image';

import { PhotoViewer } from '@/components/overlay/photo-viewer/PhotoViewer';

import { usePhotoCarousel } from './hook';
import styles from './PhotoCarousel.module.css';

type PhotoCarouselProps = {
  photos: string[];
  /** For the alt text: "{repo name} 이미지", numbered when there are several (frontend AGENTS.md) */
  repoName: string;
};

/**
 * Full-bleed 270px photo strip (Figma 286:266) with the "1/5" pill. Keyboard users move between
 * photos by tabbing through the slide buttons (each snaps into view on focus).
 */
export function PhotoCarousel({ photos, repoName }: PhotoCarouselProps) {
  const { viewer, track, index, items, onScroll, openViewer } = usePhotoCarousel(photos, repoName);
  const several = items.length > 1;

  return (
    <section aria-label="사진" className={styles.carousel}>
      <ul ref={track} className={styles.track} onScroll={(event) => onScroll(event.currentTarget)}>
        {items.map((photo, position) => (
          <li key={photo.src + position} className={styles.slide}>
            <button type="button" className={styles.open} onClick={() => openViewer(position)}>
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 600px) 600px, 100vw"
                priority={position === 0}
                className={styles.image}
              />
              <span className="sr-only"> 크게 보기</span>
            </button>
          </li>
        ))}
      </ul>
      {several && (
        <p className={styles.count} aria-live="polite">
          <span className="sr-only">사진 </span>
          {index + 1}/{items.length}
        </p>
      )}
      <PhotoViewer overlay={viewer} photos={items} />
    </section>
  );
}
