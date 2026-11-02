'use client';

// Own region: step 2 of 22 (and the edit screen): repo card, intro, body, photos, optional fields
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, GitFork, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { useDraft } from '@/features/draft-restore/use-draft';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { ImageUploader } from '@/features/image-upload/image-uploader';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { useImageUpload } from '@/features/image-upload/use-image-upload';
import { TechTagSheet } from '@/features/tech-tags/tech-tag-sheet';
import { ApiError } from '@/lib/api/api-error';
import { countChars } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS, POST } from '@/lib/policy';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

import { createPost, updatePost, type RepoSummary } from '../../_lib/editor-queries';
import {
  postFormSchema,
  toPostRequest,
  type PostDraft,
  type PostFormValues,
} from '../../_lib/schema';
import styles from './post-editor.module.css';

const GITHUB_EMAIL_SETTINGS = 'https://github.com/settings/emails';

type PostContentFormProps = {
  /** create: publishes with `repoId`; edit: updates `postId` (the repo can't change) */
  target: { mode: 'create'; repoId: number } | { mode: 'edit'; postId: string };
  repo: Omit<RepoSummary, 'photoLimit'>;
  photoLimit: number;
  initial: { values: PostFormValues; photos: UploadedImage[] };
  draftKey: string;
  /** Leave for the post (23) without the editor left in history (blueprint §7-4) */
  onSaved: (postId: number) => void;
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

export function PostContentForm({
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
  const optional = <span className={styles.optional}> (선택)</span>;

  return (
    <>
      <section aria-labelledby={field('repo')} className={styles.repoCard}>
        <h2 id={field('repo')} className={styles.repoCardName}>
          {repo.fullName}
        </h2>
        <p className={styles.repoMeta}>
          {repo.language && <span>{repo.language}</span>}
          <span className={styles.stars}>
            <Star aria-hidden className={styles.metaIcon} />
            <span className="sr-only">스타 </span>
            {repo.stars}
          </span>
          {repo.isFork && (
            <span className={styles.fork}>
              <GitFork aria-hidden className={styles.metaIcon} />
              포크{repo.parentFullName && ` · 원본 ${repo.parentFullName}`}
            </span>
          )}
        </p>
        {repo.description && <p className={styles.repoDescription}>{repo.description}</p>}
        <dl className={styles.contribution}>
          <div>
            <dt>내 커밋</dt>
            <dd>{repo.authorCommitCount}개</dd>
          </div>
          <div>
            <dt>Linker에서 처리한 이슈</dt>
            <dd>{repo.handledIssueCount}개</dd>
          </div>
        </dl>
        {repo.authorCommitCount === 0 && (
          <div className={styles.commitNotice}>
            <p>커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 숫자에 잡혀요.</p>
            <Button variant="outline" onClick={() => openExternal(GITHUB_EMAIL_SETTINGS)}>
              GitHub 이메일 설정 열기
              <ExternalLink aria-hidden />
            </Button>
          </div>
        )}
      </section>

      <form className={styles.form} noValidate aria-busy={save.isPending} onSubmit={submit}>
        <section aria-labelledby={field('content')} className={styles.section}>
          <h2 id={field('content')} className={styles.sectionTitle}>
            소개
          </h2>
          <div className={styles.field}>
            <label htmlFor={field('intro')} className={styles.label}>
              한 줄 소개 <span aria-hidden>*</span>
              <span className="sr-only">(필수)</span>
            </label>
            <input
              id={field('intro')}
              className={styles.input}
              placeholder="예: 팀 협업을 GitHub 이슈와 채팅으로 묶은 웹앱"
              aria-invalid={errors.intro ? true : undefined}
              aria-describedby={describe(field('intro-count'), errors.intro && errorId('intro'))}
              {...form.register('intro')}
            />
            <div className={styles.fieldFoot}>
              {errors.intro && (
                <p id={errorId('intro')} className={styles.error}>
                  {errors.intro.message}
                </p>
              )}
              <CharCounter
                id={field('intro-count')}
                count={countChars(watched.intro ?? '')}
                max={POST.intro.max}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor={field('body')} className={styles.label}>
              본문{optional}
            </label>
            <textarea
              id={field('body')}
              className={styles.textarea}
              rows={10}
              placeholder="어떤 문제를 풀었는지, 내가 맡은 일, 데모와 배운 점을 적어 주세요."
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={describe(
                field('body-hint'),
                field('body-count'),
                errors.body && errorId('body'),
              )}
              {...form.register('body')}
            />
            <p id={field('body-hint')} className={styles.hint}>
              마크다운은 쓸 수 없어요. 줄바꿈과 링크만 그대로 보여요.
            </p>
            <div className={styles.fieldFoot}>
              {errors.body && (
                <p id={errorId('body')} className={styles.error}>
                  {errors.body.message}
                </p>
              )}
              <CharCounter
                id={field('body-count')}
                count={countChars(watched.body ?? '')}
                max={POST.bodyMax}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={field('photos')} className={styles.section}>
          <h2 id={field('photos')} className={styles.sectionTitle}>
            사진{optional}
          </h2>
          <ImageUploader uploader={uploader} label="스크린샷·데모 사진" reorderable />
          {photoWait && !uploader.allDone && (
            <p className={styles.error} role="alert">
              사진이 모두 올라가야 게시할 수 있어요. 실패한 사진은 다시 올리거나 빼 주세요.
            </p>
          )}
        </section>

        <section aria-labelledby={field('more')} className={styles.section}>
          <h2 id={field('more')} className={styles.sectionTitle}>
            추가 정보{optional}
          </h2>

          <div className={styles.field}>
            <label htmlFor={field('role')} className={styles.label}>
              내 역할
            </label>
            <input
              id={field('role')}
              className={styles.input}
              placeholder="예: 프론트엔드, 채팅 기능 담당"
              aria-invalid={errors.myRole ? true : undefined}
              aria-describedby={describe(field('role-count'), errors.myRole && errorId('role'))}
              {...form.register('myRole')}
            />
            <div className={styles.fieldFoot}>
              {errors.myRole && (
                <p id={errorId('role')} className={styles.error}>
                  {errors.myRole.message}
                </p>
              )}
              <CharCounter
                id={field('role-count')}
                count={countChars(watched.myRole ?? '')}
                max={POST.roleMax}
              />
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>데모 링크</legend>
            <p className={styles.hint}>https 주소만, {POST.demoLinksMax}개까지 넣을 수 있어요.</p>
            {links.fields.map((item, index) => {
              const linkError = errors.demoLinks?.[index]?.url;
              const inputId = field(`link-${index}`);
              return (
                <div key={item.id} className={styles.linkRow}>
                  <label htmlFor={inputId} className="sr-only">
                    데모 링크 {index + 1}
                  </label>
                  <input
                    id={inputId}
                    type="url"
                    inputMode="url"
                    className={styles.input}
                    placeholder="https://"
                    aria-invalid={linkError ? true : undefined}
                    aria-describedby={linkError ? `${inputId}-error` : undefined}
                    {...form.register(`demoLinks.${index}.url`)}
                  />
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => links.remove(index)}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">데모 링크 {index + 1} 빼기</span>
                  </button>
                  {linkError && (
                    <p id={`${inputId}-error`} className={styles.linkError}>
                      {linkError.message}
                    </p>
                  )}
                </div>
              );
            })}
            {links.fields.length < POST.demoLinksMax && (
              <Button variant="outline" onClick={() => links.append({ url: '' })}>
                <Plus aria-hidden />
                링크 추가
              </Button>
            )}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>진행 기간</legend>
            <div className={styles.period}>
              <div className={styles.field}>
                <label htmlFor={field('start')} className={styles.subLabel}>
                  시작한 달
                </label>
                <input
                  id={field('start')}
                  type="month"
                  className={styles.input}
                  aria-invalid={errors.periodStart ? true : undefined}
                  aria-describedby={errors.periodStart ? errorId('start') : undefined}
                  {...form.register('periodStart')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={field('end')} className={styles.subLabel}>
                  끝난 달
                </label>
                <input
                  id={field('end')}
                  type="month"
                  className={styles.input}
                  aria-invalid={errors.periodEnd ? true : undefined}
                  aria-describedby={describe(field('end-hint'), errors.periodEnd && errorId('end'))}
                  {...form.register('periodEnd')}
                />
              </div>
            </div>
            <p id={field('end-hint')} className={styles.hint}>
              아직 진행 중이면 끝난 달은 비워 두세요.
            </p>
            {errors.periodStart && (
              <p id={errorId('start')} className={styles.error}>
                {errors.periodStart.message}
              </p>
            )}
            {errors.periodEnd && (
              <p id={errorId('end')} className={styles.error}>
                {errors.periodEnd.message}
              </p>
            )}
          </fieldset>

          <div className={styles.field}>
            <label htmlFor={field('team')} className={styles.label}>
              팀 규모
            </label>
            <div className={styles.suffixInput}>
              <input
                id={field('team')}
                type="number"
                inputMode="numeric"
                min={POST.teamSize.min}
                max={POST.teamSize.max}
                className={styles.input}
                aria-invalid={errors.teamSize ? true : undefined}
                aria-describedby={errors.teamSize ? errorId('team') : undefined}
                {...form.register('teamSize')}
              />
              <span aria-hidden>명</span>
            </div>
            {errors.teamSize && (
              <p id={errorId('team')} className={styles.error}>
                {errors.teamSize.message}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHead}>
              <p className={styles.label} id={field('tags')}>
                태그
              </p>
              <Button
                variant="soft"
                aria-describedby={field('tags')}
                onClick={() => tagSheet.open()}
              >
                <Plus aria-hidden />
                {tags.length > 0 ? '바꾸기' : '고르기'}
              </Button>
            </div>
            {tags.length === 0 ? (
              <p className={styles.hint}>기술 스택 태그를 {POST.tagsMax}개까지 고를 수 있어요.</p>
            ) : (
              <ul className={styles.tags} aria-labelledby={field('tags')}>
                {tags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      className={styles.tag}
                      onClick={() =>
                        form.setValue(
                          'tags',
                          tags.filter((name) => name !== tag),
                          { shouldDirty: true },
                        )
                      }
                    >
                      <span aria-hidden>{tag}</span>
                      <X aria-hidden className={styles.metaIcon} />
                      <span className="sr-only">{tag} 빼기</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {failure && (
          <div className={styles.failure} role="alert">
            <p>{failure}</p>
            <Button variant="outline" onClick={() => void submit()}>
              다시 보내기
            </Button>
          </div>
        )}

        <div className={styles.submitBar}>
          <Button type="submit" block aria-disabled={save.isPending}>
            {save.isPending ? '저장하는 중…' : creating ? '게시하기' : '수정 완료'}
          </Button>
        </div>
      </form>

      <TechTagSheet
        value={tags}
        max={POST.tagsMax}
        onSave={(names) => form.setValue('tags', names, { shouldDirty: true })}
      />
    </>
  );
}
