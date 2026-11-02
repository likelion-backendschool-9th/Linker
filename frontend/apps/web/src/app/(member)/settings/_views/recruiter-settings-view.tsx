'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/api-fetch';
import { RECRUITER } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import type { SettingsData } from '../_lib/settings-types';
import { AccountPlan, errorMessage, SettingsCommon } from './settings-common';
import styles from './settings-view.module.css';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.'),
  newPassword: z.string().min(RECRUITER.password.min, `새 비밀번호는 ${RECRUITER.password.min}자 이상 입력해 주세요.`).max(RECRUITER.password.max, `새 비밀번호는 ${RECRUITER.password.max}자 이내로 입력해 주세요.`),
  confirmPassword: z.string().min(1, '새 비밀번호를 한 번 더 입력해 주세요.'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ['confirmPassword'],
  message: '새 비밀번호가 일치하지 않아요.',
});
type PasswordValues = z.infer<typeof passwordSchema>;

export function RecruiterSettingsView({ login, settings }: { login: string; settings: SettingsData }) {
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), mode: 'onSubmit' });
  const changePassword = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      apiFetch<void>('/api/v1/recruiter/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      form.reset();
      setPasswordError(null);
      toast('비밀번호를 변경했어요.');
    },
    onError: (error) => setPasswordError(errorMessage(error, '비밀번호를 변경하지 못했어요.')),
  });

  return (
    <SettingsCommon login={login} settings={settings}>
      <AccountPlan settings={settings} />
      <section className={styles.section} aria-labelledby="scout-heading">
        <h2 id="scout-heading">Scout</h2>
        <p className={styles.description}>채용 담당자 전용 요금제예요. Scout 구독과 결제 정보는 구독 관리에서 확인할 수 있어요.</p>
      </section>
      <section className={styles.section} aria-labelledby="password-heading">
        <h2 id="password-heading">비밀번호 변경</h2>
        <form className={styles.form} onSubmit={form.handleSubmit((values) => { setPasswordError(null); changePassword.mutate(values); })}>
          <PasswordField id="current-password" label="현재 비밀번호" error={form.formState.errors.currentPassword?.message} register={form.register('currentPassword')} />
          <PasswordField id="new-password" label="새 비밀번호" error={form.formState.errors.newPassword?.message} register={form.register('newPassword')} />
          <PasswordField id="confirm-password" label="새 비밀번호 확인" error={form.formState.errors.confirmPassword?.message} register={form.register('confirmPassword')} />
          <p className={styles.description}>비밀번호는 {RECRUITER.password.min}~{RECRUITER.password.max}자로 입력해 주세요.</p>
          {passwordError && <p className={styles.error} role="alert">{passwordError}</p>}
          <Button type="submit" variant="outline" disabled={changePassword.isPending}>{changePassword.isPending ? '변경 중…' : '비밀번호 변경'}</Button>
        </form>
      </section>
    </SettingsCommon>
  );
}

function PasswordField({ id, label, error, register }: { id: string; label: string; error?: string; register: UseFormRegisterReturn }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="password" autoComplete={id === 'current-password' ? 'current-password' : 'new-password'} {...register} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <span id={`${id}-error`} className={styles.error}>{error}</span>}
    </div>
  );
}
