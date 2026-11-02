'use client';

import { ChevronLeft, ChevronRight, ImagePlus, RotateCw, X } from 'lucide-react';
import Image from 'next/image';
import { useId } from 'react';

import { IMAGE } from '@/lib/policy';

import styles from './image-uploader.module.css';
import type { ImageUploadControl } from './use-image-upload';

type ImageUploaderProps = {
  uploader: ImageUploadControl;
  label?: string;
  /** Posts: the first photo is the cover, with 앞으로/뒤로 buttons to reorder (POL-P-2, blueprint §6-5) */
  reorderable?: boolean;
};

/** Photo picker with per-photo progress and retry (07 TODO 00). The WebView uses the same `<input type="file">`. */
export function ImageUploader({
  uploader,
  label = '사진',
  reorderable = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const { items, max } = uploader;

  return (
    <div className={styles.root}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <span className={styles.count} aria-live="polite">
          {items.length}/{max}
        </span>
      </div>
      {reorderable && (
        <p id={hintId} className={styles.hint}>
          첫 번째 사진이 대표 사진이 돼요. 모든 사진이 올라가야 게시할 수 있어요.
        </p>
      )}
      <ul className={styles.grid}>
        {items.map((item, index) => (
          <li key={item.key} className={styles.cell}>
            <div className={styles.item}>
              <Image
                src={item.previewUrl}
                alt={`선택한 사진 ${index + 1}`}
                fill
                sizes="96px"
                unoptimized
                className={styles.preview}
              />
              {reorderable && index === 0 && <span className={styles.cover}>대표</span>}
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
            </div>
            {reorderable && items.length > 1 && (
              <div className={styles.order}>
                <button
                  type="button"
                  className={styles.orderButton}
                  disabled={index === 0}
                  onClick={() => uploader.move(item.key, -1)}
                >
                  <ChevronLeft aria-hidden />
                  <span className="sr-only">사진 {index + 1} 앞으로</span>
                </button>
                <button
                  type="button"
                  className={styles.orderButton}
                  disabled={index === items.length - 1}
                  onClick={() => uploader.move(item.key, 1)}
                >
                  <ChevronRight aria-hidden />
                  <span className="sr-only">사진 {index + 1} 뒤로</span>
                </button>
              </div>
            )}
          </li>
        ))}
        {items.length < max && (
          <li className={styles.cell}>
            <div className={styles.item}>
              <label htmlFor={inputId} className={styles.add}>
                <ImagePlus aria-hidden />
                <span className="sr-only">사진 추가</span>
              </label>
            </div>
          </li>
        )}
      </ul>
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept={IMAGE.mimeTypes.join(',')}
        multiple
        aria-describedby={reorderable ? hintId : undefined}
        onChange={(event) => {
          if (event.target.files) uploader.add(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
