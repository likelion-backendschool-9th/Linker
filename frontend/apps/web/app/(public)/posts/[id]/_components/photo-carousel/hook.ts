'use client';

import { useRef, useState } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

export function usePhotoCarousel(photos: string[], repoName: string) {
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

  const onScroll = (element: HTMLUListElement) => {
    setIndex(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
  };

  return {
    viewer,
    track,
    index,
    items,
    scrollTo,
    onScroll,
    openViewer: (position: number) => viewer.open(String(position)),
  };
}
