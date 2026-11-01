'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { Dialog } from 'radix-ui';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './photo-viewer.module.css';

type PhotoViewerProps = {
  /** Open with `overlay.open(String(index))`; the index lives in the URL like any overlay */
  overlay: OverlayControl;
  photos: { src: string; alt: string }[];
};

/**
 * Full-screen photo viewer (blueprint ch. 7). Previous/next are buttons, the alternative to swiping
 * (blueprint §6-5); switching photos replaces the URL so back still closes the viewer.
 */
export function PhotoViewer({ overlay, photos }: PhotoViewerProps) {
  const index = Math.min(Math.max(Number(overlay.id) || 0, 0), Math.max(photos.length - 1, 0));
  const photo = photos[index];
  const go = (next: number) => overlay.open(String(next));

  return (
    <Dialog.Root open={overlay.isOpen && Boolean(photo)} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          className={styles.viewer}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' && index > 0) go(index - 1);
            if (event.key === 'ArrowRight' && index < photos.length - 1) go(index + 1);
          }}
        >
          <div className={styles.bar}>
            <Dialog.Title className={styles.count}>
              사진 {index + 1}/{photos.length}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              앞으로, 뒤로 버튼이나 방향키로 다른 사진을 볼 수 있어요.
            </Dialog.Description>
            <Dialog.Close className={styles.button}>
              <X aria-hidden />
              <span className="sr-only">닫기</span>
            </Dialog.Close>
          </div>
          {photo && (
            <div className={styles.stage}>
              <Image src={photo.src} alt={photo.alt} fill sizes="100vw" className={styles.image} />
            </div>
          )}
          {photos.length > 1 && (
            <div className={styles.nav}>
              <button
                type="button"
                className={styles.button}
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <ChevronLeft aria-hidden />
                <span className="sr-only">앞으로</span>
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={index === photos.length - 1}
                onClick={() => go(index + 1)}
              >
                <ChevronRight aria-hidden />
                <span className="sr-only">뒤로</span>
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
