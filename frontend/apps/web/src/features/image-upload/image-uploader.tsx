'use client';

import { ImagePlus, RotateCw, X } from 'lucide-react';
import Image from 'next/image';
import { useId } from 'react';

import { IMAGE } from '@/lib/policy';

import styles from './image-uploader.module.css';
import type { ImageUploadControl } from './use-image-upload';

type ImageUploaderProps = {
  uploader: ImageUploadControl;
  label?: string;
};

/** Photo picker with per-photo progress and retry (07 TODO 00). The WebView uses the same `<input type="file">`. */
export function ImageUploader({ uploader, label = '사진' }: ImageUploaderProps) {
  const inputId = useId();
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
      <ul className={styles.grid}>
        {items.map((item, index) => (
          <li key={item.key} className={styles.item}>
            <Image
              src={item.previewUrl}
              alt={`선택한 사진 ${index + 1}`}
              fill
              sizes="96px"
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
        {items.length < max && (
          <li className={styles.item}>
            <label htmlFor={inputId} className={styles.add}>
              <ImagePlus aria-hidden />
              <span className="sr-only">사진 추가</span>
            </label>
          </li>
        )}
      </ul>
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept={IMAGE.mimeTypes.join(',')}
        multiple
        disabled={items.length >= max}
        onChange={(event) => {
          if (event.target.files) uploader.add(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
