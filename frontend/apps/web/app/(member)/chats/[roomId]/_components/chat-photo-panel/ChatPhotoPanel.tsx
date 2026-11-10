'use client';

import { RotateCw, X } from 'lucide-react';
import Image from 'next/image';
import { useId } from 'react';

import type { ImageUploadControl } from '@/features/image-upload/use-image-upload';

import styles from './ChatPhotoPanel.module.css';

/**
 * "사진 업로드 N장" panel over the composer while photos are picked (user design 2026-11-10).
 * Tiles show upload progress, retry on failure and a × to drop one; × in the header drops them all.
 */
export function ChatPhotoPanel({
  uploader,
  onClose,
}: {
  uploader: ImageUploadControl;
  onClose: () => void;
}) {
  const titleId = useId();
  const { items } = uploader;
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          사진 업로드 <span className={styles.count}>{items.length}장</span>
        </h2>
        <button type="button" className={styles.close} onClick={onClose}>
          <X aria-hidden />
          <span className="sr-only">사진 업로드 닫기</span>
        </button>
      </div>
      <ul className={styles.grid}>
        {items.map((item, index) => (
          <li key={item.key} className={styles.tile}>
            <Image
              src={item.previewUrl}
              alt={`선택한 사진 ${index + 1}`}
              fill
              sizes="100px"
              unoptimized
              className={styles.preview}
            />
            {item.status === 'uploading' && (
              <progress
                className={styles.progress}
                value={item.progress}
                max={1}
                aria-label={`사진 ${index + 1} 올리는 중`}
              />
            )}
            {item.status === 'failed' && (
              <button
                type="button"
                className={styles.retry}
                onClick={() => uploader.retry(item.key)}
              >
                <RotateCw aria-hidden />
                <span>다시 올리기</span>
              </button>
            )}
            <button
              type="button"
              className={styles.remove}
              onClick={() => uploader.remove(item.key)}
            >
              <X aria-hidden />
              <span className="sr-only">사진 {index + 1} 빼기</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
