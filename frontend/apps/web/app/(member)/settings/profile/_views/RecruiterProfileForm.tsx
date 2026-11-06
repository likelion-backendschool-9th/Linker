'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { RECRUITER } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';
import { profileQueryKey } from '@/features/profile/profile-types';
import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

import type { RecruiterProfileValues } from '../_lib/form-types';
import styles from '../_components/profile-edit-form.module.css';

const schema = z.object({
  kind: z.literal('RECRUITER'),
  name: z
    .string()
    .trim()
    .min(RECRUITER.name.min, '이름을 입력해 주세요.')
    .max(RECRUITER.name.max, `이름은 ${RECRUITER.name.max}자 이내로 입력해 주세요.`),
  company: z
    .string()
    .trim()
    .min(RECRUITER.company.min, '회사명을 입력해 주세요.')
    .max(RECRUITER.company.max, `회사명은 ${RECRUITER.company.max}자 이내로 입력해 주세요.`),
  jobTitle: z
    .string()
    .trim()
    .min(RECRUITER.jobTitle.min, '직함을 입력해 주세요.')
    .max(RECRUITER.jobTitle.max, `직함은 ${RECRUITER.jobTitle.max}자 이내로 입력해 주세요.`),
  websiteUrl: z.string().refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, '회사 웹사이트는 https 주소를 입력해 주세요.'),
  companyEmail: z.string(),
});

export function RecruiterProfileForm({
  initial,
  login,
  avatarUrl,
}: {
  initial: RecruiterProfileValues;
  login: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = useOverlay('profile-leave');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RecruiterProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: initial,
  });

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
    mutationFn: (values: RecruiterProfileValues) =>
      apiFetch<RecruiterProfileValues>('/api/v1/recruiter/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          company: values.company.trim(),
          jobTitle: values.jobTitle.trim(),
          websiteUrl: values.websiteUrl,
        }),
      }),
    onSuccess: async (saved) => {
      form.reset({ ...saved, kind: 'RECRUITER', companyEmail: initial.companyEmail });
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

  function goBack() {
    if (form.formState.isDirty) leave.open();
    else router.replace(`/users/${encodeURIComponent(login)}` as Route);
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
          aria-label="채용 담당자 프로필 정보"
          disabled={save.isPending}
        >
          <Field
            id="recruiter-name"
            label="담당자 이름"
            error={form.formState.errors.name?.message}
          >
            <input
              id="recruiter-name"
              autoComplete="name"
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'recruiter-name-error' : undefined}
              {...form.register('name')}
            />
          </Field>
          <Field
            id="recruiter-company"
            label="회사명"
            error={form.formState.errors.company?.message}
          >
            <input
              id="recruiter-company"
              autoComplete="organization"
              aria-invalid={!!form.formState.errors.company}
              aria-describedby={
                form.formState.errors.company ? 'recruiter-company-error' : undefined
              }
              {...form.register('company')}
            />
          </Field>
          <Field id="recruiter-title" label="직함" error={form.formState.errors.jobTitle?.message}>
            <input
              id="recruiter-title"
              aria-invalid={!!form.formState.errors.jobTitle}
              aria-describedby={
                form.formState.errors.jobTitle ? 'recruiter-title-error' : undefined
              }
              {...form.register('jobTitle')}
            />
          </Field>
          <Field
            id="recruiter-website"
            label="회사 웹사이트"
            error={form.formState.errors.websiteUrl?.message}
          >
            <input
              id="recruiter-website"
              type="url"
              inputMode="url"
              placeholder="https://"
              aria-invalid={!!form.formState.errors.websiteUrl}
              aria-describedby={
                form.formState.errors.websiteUrl ? 'recruiter-website-error' : undefined
              }
              {...form.register('websiteUrl')}
            />
          </Field>
          <Field id="recruiter-email" label="회사 이메일" help="회사 이메일은 변경할 수 없어요.">
            <input
              id="recruiter-email"
              type="email"
              readOnly
              aria-readonly="true"
              {...form.register('companyEmail')}
            />
          </Field>
        </fieldset>
        <div className={styles.actions}>
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
      <ConfirmDialog
        overlay={leave}
        title="수정 중인 내용을 나갈까요?"
        description="저장하지 않은 변경 내용은 사라져요."
        confirmLabel="나가기"
        destructive
        onConfirm={() => void leave.closeThen(`/users/${encodeURIComponent(login)}` as Route)}
      />
    </>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {help && <span className={styles.help}>{help}</span>}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
