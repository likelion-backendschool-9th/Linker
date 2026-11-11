'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { useDraft } from '@/features/draft-restore/use-draft';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { useImageUpload } from '@/features/image-upload/use-image-upload';
import { ApiError } from '@/lib/api/api-error';
import { noEmojiField } from '@/lib/format/no-emoji-field';
import { PLAN_LIMITS, POST } from '@/lib/policy';
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

export type PostContentFormProps = {
  /** create: publishes with `repoId`; edit: updates `postId` (the repo can't change) */
  target: { mode: 'create'; repoId: number } | { mode: 'edit'; postId: string };
  repo: Omit<RepoSummary, 'photoLimit'>;
  photoLimit: number;
  initial: { values: PostFormValues; photos: UploadedImage[] };
  draftKey: string;
  /** Leave for the post (23) without the editor left in history (blueprint §7-4) */
  onSaved: (postId: number) => void;
  /** Create step only: "변경 하기" swaps the repo in a sheet (Figma 676:836), keeping the form */
  repoChange?: { teamId: string | null; onChange: (repoId: number) => void };
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

/**
 * How many photo tiles fit on one row (Figma 274:320 stays a single row). Before the first
 * measurement every tile renders and the row clips, so SSR and the first paint never wrap.
 */
export function usePhotoRowFit() {
  const rowRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<number | null>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const style = getComputedStyle(row);
      const tile = parseFloat(style.getPropertyValue('--size-post-photo')) || 0;
      const gap = parseFloat(style.columnGap) || 0;
      if (tile <= 0) return;
      // +1px: Figma's 4 tiles (344) sit in a 343 column at 375 and still count as one row
      setFit(Math.max(1, Math.floor((row.clientWidth + gap + 1) / (tile + gap))));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return { rowRef, fit };
}

/** Grows the body textarea with its content instead of scrolling inside it */
function useAutoGrow(value: string | undefined) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  }, [value]);
  return ref;
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
  const creating = target.mode === 'create';
  const [failure, setFailure] = useState<string | null>(null);
  const [photoWait, setPhotoWait] = useState(false);
  const [photoMissing, setPhotoMissing] = useState(false);
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
      } else toast(`사진은 ${photoLimit}장까지 올릴 수 있어요.`, { tone: 'error' });
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
  const bodyRef = useAutoGrow(watched.body);
  // The intro and body take no emoji (POL-P-2): they are dropped as typed or pasted, no error shown
  const registerIntro = noEmojiField(form.register('intro'));
  const bodyField = noEmojiField(form.register('body'));
  const registerBody = {
    ...bodyField,
    ref: (el: HTMLTextAreaElement | null) => {
      bodyField.ref(el);
      bodyRef.current = el;
    },
  };
  // Team size is a text field that keeps digits only (typed or pasted)
  const teamSizeField = form.register('teamSize');
  const registerTeamSize = {
    ...teamSizeField,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '');
      if (digits !== event.target.value) event.target.value = digits;
      return teamSizeField.onChange(event);
    },
  };

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
    // Like 20: only publishing counts toward the daily limit, and its copy below replaces the shared toast
    meta: creating ? { handledCodes: ['RATE_LIMITED'] } : undefined,
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

  // POL-P-2: at least one photo (the first is the cover and the OG image on 23)
  const noPhotos = uploader.items.length === 0;
  const submit = form.handleSubmit(
    (values) => {
      setPhotoMissing(noPhotos);
      if (noPhotos) return;
      // Publish only after every photo is up (04 ch. 4 exceptions)
      if (!uploader.allDone) {
        setPhotoWait(true);
        return;
      }
      setPhotoWait(false);
      if (!save.isPending) save.mutate(values);
    },
    // Other fields are wrong too: name the missing photo in the same pass
    () => setPhotoMissing(noPhotos),
  );
  // Past the cap the message shows right away (POL-P-2), before any submit
  const teamSizeOver = Number(watched.teamSize || 0) > POST.teamSize.max;
  // Bottom CTA turns blue once the required inputs are in: one-line intro and photos all uploaded.
  // Like 20 it stays clickable while pale, so submitting still points at what's missing.
  const canSubmit =
    Boolean(watched.intro?.trim()) && !noPhotos && uploader.allDone && !teamSizeOver;
  const describe = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

  function removeTag(tag: string) {
    form.setValue(
      'tags',
      tags.filter((name) => name !== tag),
      { shouldDirty: true },
    );
  }

  /** Adds typed tags (trimmed, no repeats) up to POST.tagsMax */
  function addTags(names: string[]) {
    const next = [...tags];
    for (const raw of names) {
      const name = raw.trim();
      if (name && !next.includes(name) && next.length < POST.tagsMax) next.push(name);
    }
    if (next.length !== tags.length) form.setValue('tags', next, { shouldDirty: true });
  }

  // "#을 기준으로 태그를 나눠주세요" (Figma 285:140): typing stays plain text ("#백엔드#ci/cd");
  // Enter or blur splits it at "#" into chips under the field, and the field empties.
  const [tagText, setTagText] = useState('');
  // Enter pressed mid-composition (Korean IME) commits once the syllable is finished
  const enterWhileComposing = useRef(false);
  function commitTagText(text: string) {
    if (!text.trim()) return;
    addTags(text.split('#'));
    setTagText('');
  }
  const tagInput = {
    value: tagText,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setTagText(event.target.value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // never submits the post from here
      if (event.nativeEvent.isComposing) enterWhileComposing.current = true;
      else commitTagText(event.currentTarget.value);
    },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      if (!enterWhileComposing.current) return;
      enterWhileComposing.current = false;
      commitTagText(event.currentTarget.value);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => commitTagText(event.currentTarget.value),
  };

  function saveRole(value: string) {
    form.setValue('myRole', value, { shouldDirty: true, shouldValidate: true });
  }

  return {
    field,
    errorId,
    openExternal,
    creating,
    failure,
    photoWait,
    photoMissing: photoMissing && noPhotos,
    uploader,
    form,
    errors,
    links,
    watched,
    tags,
    registerIntro,
    registerBody,
    registerTeamSize,
    teamSizeOver,
    canSubmit,
    save,
    submit,
    describe,
    removeTag,
    tagInput,
    saveRole,
  };
}
