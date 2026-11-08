'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { useImageUpload } from '@/features/image-upload/use-image-upload';
import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS } from '@/lib/policy';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

import {
  createPost,
  postFormSchema,
  toPostRequest,
  updatePost,
  type PostDraft,
  type PostFormValues,
  type RepoSummary,
} from './api';

export const GITHUB_EMAIL_SETTINGS = 'https://github.com/settings/emails';

export type PostContentFormProps = {
  /** create: publishes with `repoId`; edit: updates `postId` (the repo can't change) */
  target: { mode: 'create'; repoId: number } | { mode: 'edit'; postId: string };
  repo: Omit<RepoSummary, 'photoLimit'>;
  photoLimit: number;
  initial: { values: PostFormValues; photos: UploadedImage[] };
  draftKey: string;
  /** Leave for the post (23) without the editor left in history (blueprint §7-4) */
  onSaved: (postId: number) => void;
  /** Create step only: go back to repo selection (Figma "변경 하기") */
  onChangeRepo?: () => void;
};

/** Why saving failed, with the 04 ch. 12 copy; the content is kept on the device first */
function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.';
  }
  if (error instanceof ApiError && error.status < 500) {
    return `${error.message} 작성한 내용은 저장해 두었어요.`;
  }
  return '게시하지 못했어요. 작성한 내용은 저장해 두었어요.';
}

export function usePostContentForm({
  target,
  repo,
  photoLimit,
  initial,
  draftKey,
  onSaved,
}: PostContentFormProps) {
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${field(name)}-error`;
  const client = useQueryClient();
  const draft = useDraft<PostDraft>(draftKey);
  const openExternal = useOpenExternal();
  const tagSheet = useOverlay('tech-tags');
  const creating = target.mode === 'create';
  const [failure, setFailure] = useState<string | null>(null);
  const [photoWait, setPhotoWait] = useState(false);
  const done = useRef(false);

  const uploader = useImageUpload(photoLimit, {
    initial: initial.photos,
    // Over the cap → the subscription prompt when Pro would allow more (07 TODO 22)
    onOverflow: () => {
      const pro = PLAN_LIMITS.photosPerPost.pro;
      if (photoLimit < pro) {
        useAppSignalStore.setState({
          planLimit: {
            reason: 'POST_PHOTOS',
            message: `사진은 ${photoLimit}장까지 올릴 수 있어요. Pro로 ${pro}장까지 늘릴 수 있어요.`,
          },
        });
      } else toast(`사진은 ${photoLimit}장까지 올릴 수 있어요.`, { tone: 'alert' });
    },
  });

  const form = useForm<PostFormValues, unknown, PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: initial.values,
    shouldFocusError: true,
  });
  const { errors, isDirty } = form.formState;
  const links = useFieldArray({ control: form.control, name: 'demoLinks' });
  const watched = useWatch({ control: form.control });
  const tags = (watched.tags ?? []).filter((tag): tag is string => Boolean(tag));
  const photoKeys = uploader.items.map((item) => item.key).join();

  // Keep what's written on the device while typing, so leaving doesn't lose it (07 TODO 22)
  const photosRef = useRef(uploader.uploaded);
  useEffect(() => {
    photosRef.current = uploader.uploaded;
  });
  useEffect(() => {
    if (
      (!isDirty && photoKeys === initial.photos.map((p) => `uploaded-${p.fileId}`).join()) ||
      done.current
    )
      return;
    const timer = window.setTimeout(() => {
      if (!done.current) {
        draft.save({
          repoId: target.mode === 'create' ? target.repoId : repo.repoId,
          values: form.getValues(),
          photos: photosRef.current,
        });
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [watched, photoKeys, isDirty, draft, form, target, repo.repoId, initial.photos]);

  const save = useMutation({
    mutationFn: (values: PostFormValues) => {
      const request = toPostRequest(values, uploader.uploaded);
      return target.mode === 'create'
        ? createPost({ repoId: target.repoId, ...request })
        : updatePost(target.postId, request);
    },
    onMutate: () => setFailure(null),
    onSuccess: async ({ id: postId }) => {
      done.current = true;
      draft.clear();
      toast(creating ? '게시물을 올렸어요.' : '게시물을 수정했어요.');
      await client.invalidateQueries({ queryKey: ['posts'] });
      onSaved(postId);
    },
    onError: (error) => {
      draft.save({
        repoId: target.mode === 'create' ? target.repoId : repo.repoId,
        values: form.getValues(),
        photos: uploader.uploaded,
      });
      // PLAN_LIMIT already opened the shared limit sheet
      if (!(error instanceof ApiError && error.code === 'PLAN_LIMIT')) {
        setFailure(saveErrorMessage(error));
      }
    },
  });

  const submit = form.handleSubmit((values) => {
    // Publish only after every photo is up (04 ch. 4 exceptions)
    if (!uploader.allDone) {
      setPhotoWait(true);
      return;
    }
    setPhotoWait(false);
    if (!save.isPending) save.mutate(values);
  });
  const describe = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

  function removeTag(tag: string) {
    form.setValue(
      'tags',
      tags.filter((name) => name !== tag),
      { shouldDirty: true },
    );
  }

  function saveTags(names: string[]) {
    form.setValue('tags', names, { shouldDirty: true });
  }

  return {
    field,
    errorId,
    openExternal,
    tagSheet,
    creating,
    failure,
    photoWait,
    uploader,
    form,
    errors,
    links,
    watched,
    tags,
    save,
    submit,
    describe,
    removeTag,
    saveTags,
  };
}
