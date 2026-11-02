'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '@/stores/toast-store';

import { uploadImage, validateImage, type UploadedImage } from './upload-image';

export type UploadItem = {
  key: string;
  /** null for a photo that was already uploaded (edit form, restored draft): nothing to retry */
  file: File | null;
  previewUrl: string;
  status: 'uploading' | 'done' | 'failed';
  progress: number;
  result?: UploadedImage;
};

type ImageUploadOptions = {
  /** Already uploaded photos to start with, in order */
  initial?: UploadedImage[];
  /** Called instead of the default toast when more photos are picked than `max` allows */
  onOverflow?: () => void;
};

const fromUploaded = (image: UploadedImage): UploadItem => ({
  key: `uploaded-${image.fileId}`,
  file: null,
  previewUrl: image.url,
  status: 'done',
  progress: 1,
  result: image,
});

/**
 * Upload state for one picker. `max` comes from `PLAN_LIMITS` by the caller (e.g. photos per post).
 * Publishing waits for `allDone` (04 ch. 4: publish only after every photo uploaded).
 */
export function useImageUpload(max: number, { initial = [], onOverflow }: ImageUploadOptions = {}) {
  const [items, setItems] = useState<UploadItem[]>(() => initial.map(fromUploaded));
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
        if (onOverflow) onOverflow();
        else toast(`사진은 ${max}장까지 올릴 수 있어요.`, { tone: 'alert' });
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
    accepted.forEach((item) => start(item.key, item.file!));
  }

  function retry(key: string) {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item?.file) start(key, item.file);
  }

  function remove(key: string) {
    const item = itemsRef.current.find((candidate) => candidate.key === key);
    if (item?.file) URL.revokeObjectURL(item.previewUrl);
    setItems((current) => current.filter((candidate) => candidate.key !== key));
  }

  /** Button alternative to dragging (blueprint §6-5): -1 = 앞으로, +1 = 뒤로. The first is the cover. */
  function move(key: string, offset: -1 | 1) {
    setItems((current) => {
      const from = current.findIndex((item) => item.key === key);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });
  }

  /** Replace everything with already uploaded photos (restoring a draft) */
  function reset(images: UploadedImage[]) {
    itemsRef.current.forEach((item) => item.file && URL.revokeObjectURL(item.previewUrl));
    setItems(images.map(fromUploaded));
  }

  useEffect(
    () => () =>
      itemsRef.current.forEach((item) => item.file && URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  return {
    items,
    max,
    add,
    retry,
    remove,
    move,
    reset,
    allDone: items.every((item) => item.status === 'done'),
    uploaded: items.flatMap((item) => (item.result ? [item.result] : [])),
  };
}

export type ImageUploadControl = ReturnType<typeof useImageUpload>;
