'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

const JOB_CATEGORY_ORDER = [
  'FRONTEND',
  'BACKEND',
  'FULLSTACK',
  'DATA_AI',
  'DEVOPS',
  'GAME',
  'EMBEDDED',
  'SECURITY',
  'MOBILE',
  'QA',
] as const;
const JOB_CATEGORY_LABELS: Record<string, string> = {
  FRONTEND: '프론트엔드',
  BACKEND: '백엔드',
  FULLSTACK: '풀스택',
  DATA_AI: '데이터 사이언티스트',
  DEVOPS: '인프라',
  GAME: '게임',
  EMBEDDED: '임베디드',
  SECURITY: '보안',
  MOBILE: '클라우드 엔지니어',
  QA: 'QA',
};

const BIO_MAX_LENGTH = 100;
const TECH_STACK_ROWS = [
  ['Java', 'Kotlin', 'JavaScript', 'TypeScript', 'Python'],
  ['Go', 'React', 'Next.js', 'Vue', 'React Native'],
  ['Spring Boot', 'Node.js', 'Django', 'FastAPI', 'PostgreSQL'],
  ['MySQL', 'Redis', 'Docker', 'AWS'],
] as const;
const TECH_STACK_OPTIONS = TECH_STACK_ROWS.flat();
const TECH_STACK_LABELS: Record<string, string> = {
  Vue: 'Vue.js',
};

const schema = z.object({
  kind: z.literal('DEVELOPER'),
  name: z
    .string()
    .trim()
    .min(PROFILE.displayName.min, '이름을 입력해 주세요.')
    .max(PROFILE.displayName.max, `이름은 ${PROFILE.displayName.max}자 이내로 입력해 주세요.`),
  bio: z
    .string()
    .trim()
    .min(1, '자기 소개를 입력해 주세요.')
    .max(BIO_MAX_LENGTH, `자기 소개는 ${BIO_MAX_LENGTH}자 이내로 입력해 주세요.`),
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
  techTags,
  jobCategories,
}: {
  initial: DeveloperProfileValues;
  login: string;
  avatarUrl?: string | null;
  techTags: TechTag[];
  jobCategories: JobCategory[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const techSheet = useOverlay('profile-edit-tech');
  const jobSheet = useOverlay('profile-edit-job');
  const categorySheet = useOverlay('profile-edit-categories');
  const leave = useOverlay('profile-leave');
  const [error, setError] = useState<string | null>(null);
  const [jobStatusChosen, setJobStatusChosen] = useState(initial.jobStatus !== 'OFF');
  const form = useForm<DeveloperProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: initial,
  });
  const currentValues = useWatch({ control: form.control, defaultValue: initial });
  const hasProfileChanges =
    currentValues.name !== initial.name ||
    currentValues.bio !== initial.bio ||
    currentValues.blogUrl !== initial.blogUrl ||
    hasStringArrayChanged(currentValues.techStack ?? initial.techStack, initial.techStack) ||
    currentValues.lookingForTeam !== initial.lookingForTeam ||
    currentValues.jobStatus !== initial.jobStatus ||
    hasStringArrayChanged(currentValues.jobCategories ?? initial.jobCategories, initial.jobCategories) ||
    jobStatusChosen !== (initial.jobStatus !== 'OFF');
  const selectedTech = useWatch({ control: form.control, name: 'techStack' }) ?? [];
  const [selectedTechOccurrence, setSelectedTechOccurrence] = useState<Record<string, number>>(() => {
    const occurrences: Record<string, number> = {};
    initial.techStack.forEach((name) => {
      const optionIndex = TECH_STACK_OPTIONS.findIndex((option) => option === name);
      if (optionIndex !== -1) {
        occurrences[name] = optionIndex;
      }
    });
    return occurrences;
  });
  const selectedCategories = useWatch({ control: form.control, name: 'jobCategories' }) ?? [];
  const jobStatus = useWatch({ control: form.control, name: 'jobStatus' });
  const bio = useWatch({ control: form.control, name: 'bio' }) ?? '';
  const jobLabel = JOB_STATUS.find((option) => option.value === jobStatus)?.label ?? '';
  const jobStatusLabel = jobStatusChosen ? jobLabel : '현재 구직 상태를 알려주세요';
  const orderedJobCategories = JOB_CATEGORY_ORDER.flatMap((key) =>
    jobCategories.filter((category) => category.key === key),
  );
  const categoryLabels = orderedJobCategories
    .filter((category) => selectedCategories.includes(category.key))
    .map((category) => JOB_CATEGORY_LABELS[category.key] ?? category.label);

  useEffect(() => {
    useUnsavedChangesStore.getState().setDirty(hasProfileChanges);
    return () => useUnsavedChangesStore.getState().setDirty(false);
  }, [hasProfileChanges]);

  useEffect(() => {
    if (!hasProfileChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasProfileChanges]);

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
    onSuccess: (saved) => {
      form.reset({ ...saved, kind: 'DEVELOPER' });
      useUnsavedChangesStore.getState().setDirty(false);
      void queryClient.invalidateQueries({ queryKey: profileQueryKey(login) });
      toast('프로필을 저장했어요.');
    },
    onError: (cause) =>
      setError(
        cause instanceof ApiError
          ? cause.message
          : '프로필을 저장하지 못했어요. 다시 시도해 주세요.',
      ),
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

  function renderTechChip(tag: TechTag, optionIndex: number) {
    const checked =
      selectedTech.includes(tag.name) && selectedTechOccurrence[tag.name] === optionIndex;
    return (
      <li key={`${tag.id}-${optionIndex}`}>
        <label className={styles.techStackChip} data-selected={checked}>
          <input
            className="sr-only"
            type="checkbox"
            checked={checked}
            disabled={
              !checked &&
              !selectedTech.includes(tag.name) &&
              selectedTech.length >= PROFILE.techStackMax
            }
            onChange={() => {
              if (checked) {
                toggleTech(tag.name);
                setSelectedTechOccurrence((current) => {
                  const next = { ...current };
                  delete next[tag.name];
                  return next;
                });
              } else if (selectedTech.includes(tag.name)) {
                setSelectedTechOccurrence((current) => ({
                  ...current,
                  [tag.name]: optionIndex,
                }));
              } else if (selectedTech.length < PROFILE.techStackMax) {
                toggleTech(tag.name);
                setSelectedTechOccurrence((current) => ({
                  ...current,
                  [tag.name]: optionIndex,
                }));
              }
            }}
          />
          {TECH_STACK_LABELS[tag.name] ?? tag.name}
        </label>
      </li>
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

  const pending = save.isPending;

  return (
    <>
      <form
        className={`${styles.sheetForm} ${styles.profileForm}`}
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            await save.mutateAsync(values);
            router.replace(`/user/${encodeURIComponent(login)}` as Route);
          } catch {
            // The mutation's onError handler displays the save failure.
          }
        })}
      >
        <fieldset className={styles.fields} aria-label="프로필 정보" disabled={pending}>
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
                maxLength={BIO_MAX_LENGTH}
                placeholder="개발자님을 간단하게 소개해 주세요"
                aria-invalid={!!form.formState.errors.bio}
                aria-describedby={form.formState.errors.bio ? 'profile-bio-error' : 'profile-bio-count'}
                {...form.register('bio')}
              />
              <span id="profile-bio-count" className={styles.counter}>
                {bio.length}/{BIO_MAX_LENGTH}
              </span>
            </span>
          </Field>
          <div className={styles.pickerField}>
            <span className={styles.labelRow} id="job-status-label">
              구직 상태
              <span className={styles.required} aria-hidden="true" />
            </span>
            <button
              type="button"
              className={styles.selectRow}
              data-filled={jobStatusChosen}
              aria-label={`구직 상태, ${jobStatusLabel}`}
              onClick={() => jobSheet.open()}
            >
              <span>{jobStatusLabel}</span>
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

          <fieldset className={`${styles.pickerField} ${styles.categoryPickerField}`}>
            <legend className={`${styles.labelRow} ${styles.categoryPickerLabel}`}>
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
        </fieldset>

        <div className={styles.footer}>
          <button
            type="submit"
            className={styles.profileNextButton}
            disabled={!hasProfileChanges || save.isPending}
            aria-busy={save.isPending}
          >
            저장
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
        description="구직 상태"
        describeHidden
        classNames={{
          scrim: styles.jobStatusScrim,
          sheet: styles.jobStatusSheet,
          header: styles.jobStatusHeader,
          title: styles.jobStatusTitle,
          close: styles.jobStatusClose,
          body: styles.jobStatusBody,
        }}
      >
        <div
          className={`${styles.choiceList} ${styles.jobStatusChoiceList}`}
          role="radiogroup"
          aria-label="구직 상태"
        >
          {JOB_STATUS.map((option) => (
            <label
              key={option.value}
              className={`${styles.choice} ${styles.jobStatusChoice}`}
              data-selected={jobStatus === option.value}
            >
              <input
                className="sr-only"
                type="radio"
                value={option.value}
                checked={jobStatus === option.value}
                onChange={() => {
                  setJobStatusChosen(true);
                  form.setValue('jobStatus', option.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
          <button
            type="button"
            className={`${styles.saveButton} ${styles.jobStatusDoneButton}`}
            onClick={() => jobSheet.close()}
          >
            완료
          </button>
      </OverlaySheet>

      <OverlaySheet
        overlay={techSheet}
        title="기술 스택"
        description={`최대 ${PROFILE.techStackMax}개까지 선택할 수 있어요.`}
        describeHidden
        classNames={{
          scrim: styles.jobStatusScrim,
          sheet: styles.techStackSheet,
          header: styles.jobStatusHeader,
          title: styles.jobStatusTitle,
          close: styles.jobStatusClose,
          body: styles.techStackBody,
        }}
      >
        <div className={styles.techStackChipRows}>
          <ul className={styles.techStackChipRow}>
            {TECH_STACK_OPTIONS.map((name, optionIndex) => {
              const tag = techTags.find((option) => option.name === name);
              if (!tag) return null;
              return renderTechChip(tag, optionIndex);
            })}
          </ul>
        </div>
        <button
          type="button"
          className={`${styles.saveButton} ${styles.jobStatusDoneButton}`}
          onClick={() => techSheet.close()}
        >
          완료
        </button>
      </OverlaySheet>

      <OverlaySheet
        overlay={categorySheet}
        title="관심 직군"
        description="관심 직군"
        describeHidden
        classNames={{
          scrim: styles.jobStatusScrim,
          sheet: styles.categorySheet,
          header: styles.jobStatusHeader,
          title: styles.jobStatusTitle,
          close: styles.jobStatusClose,
          body: styles.categoryBody,
        }}
      >
        <div className={`${styles.choiceList} ${styles.categoryList}`}>
          {orderedJobCategories.map((category) => {
            const checked = selectedCategories.includes(category.key);
            return (
              <label
                key={category.key}
                className={`${styles.choice} ${styles.jobStatusChoice}`}
                data-selected={checked}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selectedCategories.length >= PROFILE.jobCategoriesMax}
                  onChange={() => toggleCategory(category.key)}
                />
                {JOB_CATEGORY_LABELS[category.key] ?? category.label}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className={`${styles.saveButton} ${styles.jobStatusDoneButton}`}
          onClick={() => categorySheet.close()}
        >
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

function hasStringArrayChanged(current: string[], initial: string[]) {
  return current.length !== initial.length || current.some((value, index) => value !== initial[index]);
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
