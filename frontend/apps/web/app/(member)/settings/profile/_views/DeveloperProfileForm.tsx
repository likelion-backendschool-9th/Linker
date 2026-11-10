'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Route } from 'next';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { PROFILE } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';
import { profileQueryKey } from '@/features/profile/profile-types';
import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

import type { DeveloperProfileValues, JobCategory, TechTag } from '../_lib/form-types';
import styles from '../_components/profile-edit-form.module.css';

const JOB_STATUS = [
  { value: 'SEEKING', label: '구직 중' },
  { value: 'OPEN', label: '제안 받기' },
  { value: 'OFF', label: '구직 안 함' },
] as const;

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
  avatarUrl: _avatarUrl,
  techTags,
  jobCategories,
}: {
  initial: DeveloperProfileValues;
  login: string;
  avatarUrl: string | null;
  techTags: TechTag[];
  jobCategories: JobCategory[];
}) {
  const queryClient = useQueryClient();
  const techSheet = useOverlay('profile-edit-tech');
  const jobSheet = useOverlay('profile-edit-job');
  const categorySheet = useOverlay('profile-edit-categories');
  const leave = useOverlay('profile-leave');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DeveloperProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: initial,
  });
  const selectedTech = useWatch({ control: form.control, name: 'techStack' }) ?? [];
  const selectedCategories = useWatch({ control: form.control, name: 'jobCategories' }) ?? [];
  const jobStatus = useWatch({ control: form.control, name: 'jobStatus' });
  const bio = useWatch({ control: form.control, name: 'bio' }) ?? '';
  const jobLabel = JOB_STATUS.find((option) => option.value === jobStatus)?.label ?? '';
  const categoryLabels = jobCategories
    .filter((category) => selectedCategories.includes(category.key))
    .map((category) => category.label);

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
    if (!current.includes(name) && current.length >= PROFILE.techStackMax) return;
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

  const pending = save.isPending || sync.isPending;

  return (
    <>
      <form
        className={styles.sheetForm}
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          save.mutate(values);
        })}
      >
        <fieldset className={styles.fields} aria-label="개발자 프로필 정보" disabled={pending}>
          <Field id="profile-name" label="이름" required error={form.formState.errors.name?.message}>
            <input
              id="profile-name"
              autoComplete="name"
              placeholder="실명을 작성해 주세요"
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'profile-name-error' : undefined}
              {...form.register('name')}
            />
          </Field>
          <Field
            id="profile-bio"
            label="자기 소개"
            required
            error={form.formState.errors.bio?.message}
          >
            <span className={styles.control}>
              <textarea
                id="profile-bio"
                rows={4}
                maxLength={PROFILE.bioMax}
                placeholder="개발자님을 간단하게 소개해 주세요"
                aria-invalid={!!form.formState.errors.bio}
                aria-describedby={form.formState.errors.bio ? 'profile-bio-error' : 'profile-bio-count'}
                {...form.register('bio')}
              />
              <span id="profile-bio-count" className={styles.counter}>
                {bio.length}/{PROFILE.bioMax}
              </span>
            </span>
          </Field>
          <Field id="profile-blog" label="블로그 주소" error={form.formState.errors.blogUrl?.message}>
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

          <div className={styles.pickerField}>
            <span className={styles.labelRow} id="job-status-label">
              구직 상태
              <span className={styles.required} aria-hidden="true" />
            </span>
            <button
              type="button"
              className={styles.selectRow}
              data-filled="true"
              aria-label={`구직 상태, ${jobLabel}`}
              onClick={() => jobSheet.open()}
            >
              <span>{jobLabel}</span>
              <ChevronDown aria-hidden="true" />
            </button>
          </div>

          <div className={styles.pickerField}>
            <span className={styles.labelRow} id="tech-title">
              기술 스택
              <span className={styles.hint}>최대 {PROFILE.techStackMax}개</span>
            </span>
            <button
              type="button"
              className={styles.selectRow}
              data-filled={selectedTech.length > 0}
              aria-label={
                selectedTech.length > 0
                  ? `기술 스택, ${selectedTech.join(', ')}`
                  : `기술 스택, 최대 ${PROFILE.techStackMax}개를 선택하실 수 있습니다`
              }
              onClick={() => techSheet.open()}
            >
              <span>
                {selectedTech.length > 0
                  ? selectedTech.join(', ')
                  : `최대 ${PROFILE.techStackMax}개를 선택하실 수 있습니다`}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
          </div>

          <fieldset className={styles.pickerField}>
            <legend className={styles.labelRow}>
              관심 직군
              <span className={styles.hint}>최대 {PROFILE.jobCategoriesMax}개</span>
            </legend>
            <button
              type="button"
              className={styles.selectRow}
              data-filled={categoryLabels.length > 0}
              onClick={() => categorySheet.open()}
            >
              <span>
                {categoryLabels.length > 0
                  ? categoryLabels.join(', ')
                  : '관심있는 직군을 선택해 주세요'}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
          </fieldset>

          <label className={styles.option}>
            <input type="checkbox" {...form.register('lookingForTeam')} />
            함께할 팀을 찾고 있어요
          </label>
        </fieldset>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.syncButton}
            onClick={() => sync.mutate()}
            disabled={sync.isPending || form.formState.isDirty || pending}
            aria-busy={sync.isPending}
          >
            {sync.isPending ? '불러오는 중…' : 'GitHub에서 다시 불러오기'}
          </button>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={!form.formState.isDirty || save.isPending}
            aria-busy={save.isPending}
          >
            {save.isPending ? '저장 중…' : '저장'}
          </button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </form>

      <OverlaySheet
        overlay={jobSheet}
        title="구직 상태"
        description="현재 구직 상태를 선택해 주세요."
        describeHidden
      >
        <div className={styles.choiceList} role="radiogroup" aria-label="구직 상태">
          {JOB_STATUS.map((option) => (
            <label key={option.value} className={styles.choice} data-selected={jobStatus === option.value}>
              <input
                className="sr-only"
                type="radio"
                value={option.value}
                checked={jobStatus === option.value}
                onChange={() =>
                  form.setValue('jobStatus', option.value, { shouldDirty: true, shouldValidate: true })
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <button type="button" className={styles.saveButton} onClick={() => jobSheet.close()}>
          완료
        </button>
      </OverlaySheet>

      <OverlaySheet
        overlay={techSheet}
        title="기술 스택"
        description={`최대 ${PROFILE.techStackMax}개까지 선택할 수 있어요.`}
        describeHidden
      >
        <ul className={styles.chipCloud}>
          {techTags.map((tag) => {
            const checked = selectedTech.includes(tag.name);
            return (
              <li key={tag.id}>
                <label className={styles.chip} data-selected={checked}>
                  <input
                    className="sr-only"
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && selectedTech.length >= PROFILE.techStackMax}
                    onChange={() => toggleTech(tag.name)}
                  />
                  {tag.name}
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.saveButton} onClick={() => techSheet.close()}>
          완료
        </button>
      </OverlaySheet>

      <OverlaySheet
        overlay={categorySheet}
        title="관심 직군"
        description="관심 직군을 고르면 그 직군의 채용 광고만 피드에 보여요. 비워 두면 광고가 뜨지 않아요."
      >
        <div className={styles.choiceList}>
          {jobCategories.map((category) => {
            const checked = selectedCategories.includes(category.key);
            return (
              <label key={category.key} className={styles.choice} data-selected={checked}>
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selectedCategories.length >= PROFILE.jobCategoriesMax}
                  onChange={() => toggleCategory(category.key)}
                />
                {category.label}
              </label>
            );
          })}
        </div>
        <button type="button" className={styles.saveButton} onClick={() => categorySheet.close()}>
          완료
        </button>
      </OverlaySheet>

      <ConfirmDialog
        overlay={leave}
        title="수정 중인 내용을 나갈까요?"
        description="저장하지 않은 변경 내용은 사라져요."
        confirmLabel="나가기"
        destructive
        onConfirm={() => void leave.closeThen(`/user/${encodeURIComponent(login)}` as Route)}
      />
    </>
  );
}

function Field({
  id,
  label,
  required = false,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.labelRow} htmlFor={id}>
        {label}
        {required && <span className={styles.required} aria-hidden="true" />}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
