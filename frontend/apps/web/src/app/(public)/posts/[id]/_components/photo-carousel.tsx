'use client';

// Own region: swipeable photos with buttons and the full-screen viewer (07 TODO 23)
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { PhotoViewer } from '@/components/overlay/photo-viewer';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './photo-carousel.module.css';

type PhotoCarouselProps = {
  photos: string[];
  /** For the alt text: "{repo name} 이미지", numbered when there are several (frontend AGENTS.md) */
  repoName: string;
};

export function PhotoCarousel({ photos, repoName }: PhotoCarouselProps) {
  const viewer = useOverlay('photo-viewer');
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const items = photos.map((src, position) => ({
    src,
    alt: photos.length > 1 ? `${repoName} 이미지 ${position + 1}` : `${repoName} 이미지`,
  }));

  const scrollTo = (next: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollTo({ left: next * element.clientWidth });
    setIndex(next);
  };

  return (
    <section aria-label="사진" className={styles.carousel}>
      <ul
        ref={track}
        className={styles.track}
        onScroll={(event) => {
          const element = event.currentTarget;
          setIndex(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
        }}
      >
        {items.map((photo, position) => (
          <li key={photo.src + position} className={styles.slide}>
            <button
              type="button"
              className={styles.open}
              onClick={() => viewer.open(String(position))}
            >
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
