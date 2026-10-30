'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '@/stores/toast-store';

import { uploadImage, validateImage, type UploadedImage } from './upload-image';

export type UploadItem = {
  key: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'done' | 'failed';
  progress: number;
  result?: UploadedImage;
};

/**
 * Upload state for one picker. `max` comes from `PLAN_LIMITS` by the caller (e.g. photos per post).
 * Publishing waits for `allDone` (04 ch. 4: publish only after every photo uploaded).
 */
export function useImageUpload(max: number) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  const patch = useCallback((key: string, change: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }, []);

  const start = useCallback(
    (key: string, file: File) => {
      patch(key, { status: 'uploading', progress: 0 });
      uploadImage(file, (progress) => patch(key, { progress }))
        .then((result) => patch(key, { status: 'done', progress: 1, result }))
        .catch(() => patch(key, { status: 'failed' }));
    },
    [patch],
  );

  function add(files: FileList | File[]) {
    const room = max - itemsRef.current.length;
    const accepted: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const error = validateImage(file);
      if (error) {
        toast(error, { tone: 'alert' });
        continue;
      }
      if (accepted.length >= room) {
        toast(`사진은 ${max}장까지 올릴 수 있어요.`, { tone: 'alert' });
        break;
      }
      accepted.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'uploading',
        progress: 0,
      });
    }
    setItems((current) => [...current, ...accepted]);
    accepted.forEach((item) => start(item.key, item.file));
  }

  function retry(key: string) {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item) start(key, item.file);
  }

  function remove(key: string) {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setItems((current) => current.filter((candidate) => candidate.key !== key));
  }

  useEffect(
    () => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  return {
    items,
    max,
    add,
    retry,
    remove,
    allDone: items.every((item) => item.status === 'done'),
    uploaded: items.flatMap((item) => (item.result ? [item.result] : [])),
  };
}

export type ImageUploadControl = ReturnType<typeof useImageUpload>;
