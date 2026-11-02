'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Route } from 'next';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { Button } from '@/components/ui/button';
import { TechTagPicker } from '@/features/profile/tech-tag-picker';
import { JobStatusPicker } from '@/features/profile/job-status-picker';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { PROFILE } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';
import { profileQueryKey } from '@/features/profile/profile-types';
import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

import type { DeveloperProfileValues, JobCategory, TechTag } from '../_lib/form-types';
import styles from '../_components/profile-edit-form.module.css';

const schema = z.object({
  kind: z.literal('DEVELOPER'),
  name: z
    .string()
    .trim()
    .min(PROFILE.displayName.min, '이름을 입력해 주세요.')
    .max(PROFILE.displayName.max, `이름은 ${PROFILE.displayName.max}자 이내로 입력해 주세요.`),
  bio: z.string().max(PROFILE.bioMax, `소개는 ${PROFILE.bioMax}자 이내로 입력해 주세요.`),
  blogUrl: z.string().refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, '블로그 주소는 https로 시작해야 해요.'),
  techStack: z
    .array(z.string())
    .max(PROFILE.techStackMax, `기술 스택은 ${PROFILE.techStackMax}개까지 선택할 수 있어요.`),
  lookingForTeam: z.boolean(),
  jobStatus: z.enum(['SEEKING', 'OPEN', 'OFF']),
  jobCategories: z
    .array(z.string())
    .max(
      PROFILE.jobCategoriesMax,
      `관심 직군은 ${PROFILE.jobCategoriesMax}개까지 선택할 수 있어요.`,
    ),
});

export function DeveloperProfileForm({
  initial,
  login,
  avatarUrl,
  techTags,
  jobCategories,
}: {
  initial: DeveloperProfileValues;
  login: string;
  avatarUrl: string | null;
  techTags: TechTag[];
  jobCategories: JobCategory[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const picker = useOverlay('tech-tags');
  const leave = useOverlay('profile-leave');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DeveloperProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: initial,
  });
  const selectedTech = useWatch({ control: form.control, name: 'techStack' }) ?? [];
  const selectedCategories = useWatch({ control: form.control, name: 'jobCategories' }) ?? [];
  const bio = useWatch({ control: form.control, name: 'bio' }) ?? '';

  useEffect(() => {
    useUnsavedChangesStore.getState().setDirty(form.formState.isDirty);
    return () => useUnsavedChangesStore.getState().setDirty(false);
  }, [form.formState.isDirty]);

  useEffect(() => {
    if (!form.formState.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form.formState.isDirty]);

  const save = useMutation({
    mutationFn: (values: DeveloperProfileValues) =>
      apiFetch<DeveloperProfileValues>('/api/v1/user/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          bio: values.bio,
          blogUrl: values.blogUrl,
          techStack: values.techStack,
          lookingForTeam: values.lookingForTeam,
          jobStatus: values.jobStatus,
          jobCategories: values.jobCategories,
        }),
      }),
    onSuccess: async (saved) => {
      form.reset({ ...saved, kind: 'DEVELOPER' });
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(login) });
      toast('프로필을 저장했어요.');
      router.refresh();
    },
    onError: (cause) =>
      setError(
        cause instanceof ApiError
          ? cause.message
          : '프로필을 저장하지 못했어요. 다시 시도해 주세요.',
      ),
  });

  const sync = useMutation({
    mutationFn: () =>
      apiFetch<DeveloperProfileValues & { syncedAt: string }>(
        '/api/v1/user/me/profile/github-sync',
        { method: 'POST' },
      ),
    onSuccess: async (synced) => {
      form.reset({
        kind: 'DEVELOPER',
        name: synced.name,
        bio: synced.bio,
        blogUrl: synced.blogUrl,
        techStack: synced.techStack,
        lookingForTeam: synced.lookingForTeam,
        jobStatus: synced.jobStatus,
        jobCategories: form.getValues('jobCategories'),
      });
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(login) });
      toast('GitHub 프로필을 다시 불러왔어요.');
    },
    onError: (cause) =>
      setError(cause instanceof ApiError ? cause.message : 'GitHub 정보를 불러오지 못했어요.'),
  });

  function toggleTech(name: string) {
    const current = form.getValues('techStack');
    form.setValue(
      'techStack',
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function toggleCategory(key: string) {
    const current = form.getValues('jobCategories');
    if (!current.includes(key) && current.length >= PROFILE.jobCategoriesMax) return;
    form.setValue(
      'jobCategories',
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function goBack() {
    if (form.formState.isDirty) leave.open();
    else router.replace(`/u/${encodeURIComponent(login)}` as Route);
  }

  return (
    <>
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          save.mutate(values);
        })}
      >
        <div className={styles.avatarRow}>
          {avatarUrl && (
            <span className={styles.avatar}>
              <Image src={avatarUrl} alt="" fill sizes="80px" />
            </span>
          )}
          <div className={styles.info}>
            <p>GitHub 프로필 사진을 사용하고 있어요.</p>
            <p className={styles.muted}>프로필 사진은 GitHub에서 변경할 수 있어요.</p>
          </div>
        </div>

        <fieldset
          className={styles.fields}
          aria-label="개발자 프로필 정보"
          disabled={save.isPending || sync.isPending}
        >
          <Field id="profile-name" label="이름" error={form.formState.errors.name?.message}>
            <input
              id="profile-name"
              autoComplete="name"
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'profile-name-error' : undefined}
              {...form.register('name')}
            />
          </Field>
          <Field id="profile-bio" label="소개" error={form.formState.errors.bio?.message}>
            <textarea
              id="profile-bio"
              rows={4}
              maxLength={PROFILE.bioMax}
              aria-invalid={!!form.formState.errors.bio}
              aria-describedby={
                form.formState.errors.bio ? 'profile-bio-error' : 'profile-bio-count'
              }
              {...form.register('bio')}
            />
            <span id="profile-bio-count" className={styles.counter}>
              {bio.length}/{PROFILE.bioMax}
            </span>
          </Field>
          <Field
            id="profile-blog"
            label="블로그 주소"
            error={form.formState.errors.blogUrl?.message}
          >
            <input
              id="profile-blog"
              type="url"
              inputMode="url"
              placeholder="https://"
              aria-invalid={!!form.formState.errors.blogUrl}
              aria-describedby={form.formState.errors.blogUrl ? 'profile-blog-error' : undefined}
              {...form.register('blogUrl')}
            />
          </Field>

          <section className={styles.fieldset} aria-labelledby="tech-title">
            <span className={styles.label} id="tech-title">
              기술 스택
            </span>
            <p className={styles.help}>
              {selectedTech.length}/{PROFILE.techStackMax}개 선택
            </p>
            <ul className={styles.tags} aria-label="선택한 기술 스택">
              {selectedTech.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={() => picker.open()}>
              기술 스택 선택
            </Button>
          </section>

          <label className={styles.option}>
            <input type="checkbox" {...form.register('lookingForTeam')} />
            함께할 팀을 찾고 있어요
          </label>

          <JobStatusPicker
            register={form.register('jobStatus')}
            disabled={save.isPending || sync.isPending}
          />

          <fieldset className={styles.fieldset}>
            <legend>
              관심 직군 <span className={styles.muted}>(선택)</span>
            </legend>
            <p className={styles.help}>
              관심 직군을 고르면 그 직군의 채용 광고만 피드에 보여요. 비워 두면 광고가 뜨지 않아요.
            </p>
            <ul className={styles.categories}>
              {jobCategories.map((category) => {
                const checked = selectedCategories.includes(category.key);
                return (
                  <li key={category.key}>
                    <label className={styles.option}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selectedCategories.length >= PROFILE.jobCategoriesMax}
                        onChange={() => toggleCategory(category.key)}
                      />
                      {category.label}
                    </label>
                  </li>
                );
              })}
            </ul>
            <span className={styles.counter}>
              {selectedCategories.length}/{PROFILE.jobCategoriesMax}개 선택
            </span>
          </fieldset>
        </fieldset>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || form.formState.isDirty}
            aria-busy={sync.isPending}
          >
            {sync.isPending ? '불러오는 중…' : 'GitHub에서 다시 불러오기'}
          </Button>
          <Button type="button" variant="outline" onClick={goBack}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || save.isPending}
            aria-busy={save.isPending}
          >
            {save.isPending ? '저장 중…' : '저장'}
          </Button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      <TechTagPicker
        overlay={picker}
        tags={techTags}
        selected={selectedTech}
        max={PROFILE.techStackMax}
        onToggle={toggleTech}
      />
      <ConfirmDialog
        overlay={leave}
        title="수정 중인 내용을 나갈까요?"
        description="저장하지 않은 변경 내용은 사라져요."
        confirmLabel="나가기"
        destructive
        onConfirm={() => void leave.closeThen(`/u/${encodeURIComponent(login)}` as Route)}
      />
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
