'use client';

// Own region: swipeable photos with buttons and the full-screen viewer (07 TODO 23)
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

import { PhotoViewer } from '@/components/overlay/photo-viewer/PhotoViewer';

import { usePhotoCarousel } from './hook';
import styles from './PhotoCarousel.module.css';

type PhotoCarouselProps = {
  photos: string[];
  /** For the alt text: "{repo name} 이미지", numbered when there are several (frontend AGENTS.md) */
  repoName: string;
};

export function PhotoCarousel({ photos, repoName }: PhotoCarouselProps) {
  const { viewer, track, index, items, scrollTo, onScroll, openViewer } = usePhotoCarousel(
    photos,
    repoName,
  );

  return (
    <section aria-label="사진" className={styles.carousel}>
      <ul
        ref={track}
        className={styles.track}
        onScroll={(event) => onScroll(event.currentTarget)}
      >
        {items.map((photo, position) => (
          <li key={photo.src + position} className={styles.slide}>
            <button type="button" className={styles.open} onClick={() => openViewer(position)}>
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                priority={position === 0}
                className={styles.image}
              />
              <span className="sr-only"> 크게 보기</span>
            </button>
          </li>
        ))}
      </ul>
      {items.length > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.step}
            disabled={index === 0}
            onClick={() => scrollTo(index - 1)}
          >
            <ChevronLeft aria-hidden />
            <span className="sr-only">이전 사진</span>
          </button>
          <p className={styles.count} aria-live="polite">
            <span className="sr-only">사진 </span>
            {index + 1}/{items.length}
          </p>
          <button
            type="button"
            className={styles.step}
            disabled={index === items.length - 1}
            onClick={() => scrollTo(index + 1)}
          >
            <ChevronRight aria-hidden />
            <span className="sr-only">다음 사진</span>
          </button>
        </div>
      )}
      <PhotoViewer overlay={viewer} photos={items} />
    </section>
  );
}
