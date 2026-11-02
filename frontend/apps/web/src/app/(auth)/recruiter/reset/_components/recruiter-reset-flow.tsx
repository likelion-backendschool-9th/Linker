'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { RECRUITER } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import styles from '@/features/auth/recruiter-auth.module.css';

const emailSchema = z.object({ email: z.string().trim().email('회사 이메일 형식을 확인해 주세요.') });
type EmailValues = z.infer<typeof emailSchema>;
const passwordSchema = z.object({
  password: z.string().min(RECRUITER.password.min, `비밀번호는 ${RECRUITER.password.min}자 이상 입력해 주세요.`).max(RECRUITER.password.max, `비밀번호는 ${RECRUITER.password.max}자 이내로 입력해 주세요.`).refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), '비밀번호에 영문과 숫자를 모두 포함해 주세요.'),
  confirmPassword: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
}).refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: '비밀번호가 일치하지 않아요.' });
type PasswordValues = z.infer<typeof passwordSchema>;

export function RecruiterResetFlow({ token }: { token: string }) {
  const router = useRouter();
  const [requestSent, setRequestSent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema), mode: 'onSubmit', shouldFocusError: true, defaultValues: { email: '' } });
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), mode: 'onSubmit', shouldFocusError: true, defaultValues: { password: '', confirmPassword: '' } });

  const tokenStatus = useQuery({
    queryKey: ['recruiter-password-reset-token', token],
    queryFn: () => apiFetch<{ valid: boolean }>(`/api/v1/public/recruiter-auth/password-reset/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });

  const request = useMutation({
    mutationFn: (values: EmailValues) => apiFetch<{ sent: boolean }>('/api/v1/public/recruiter-auth/password-reset-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.email.trim() }),
    }),
    onSuccess: () => { setRequestSent(true); setApiError(null); },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : '재설정 링크를 요청하지 못했어요. 다시 시도해 주세요.'),
  });

  const reset = useMutation({
    mutationFn: (values: PasswordValues) => apiFetch<void>('/api/v1/public/recruiter-auth/password-reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: values.password }),
    }),
    onSuccess: () => {
      toast('비밀번호를 재설정했어요. 다시 로그인해 주세요.');
      router.replace('/recruiter/login');
    },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : '비밀번호를 재설정하지 못했어요. 다시 시도해 주세요.'),
  });

  return (
    <section className={styles.container} aria-label="비밀번호 재설정">
      {!token && <form className={styles.form} noValidate onSubmit={emailForm.handleSubmit((values) => { setApiError(null); request.mutate(values); })}>
        <h2 className={styles.heading}>비밀번호를 잊으셨나요?</h2>
        <p className={styles.description}>가입한 회사 이메일을 입력하면 비밀번호 재설정 링크를 보내 드려요.</p>
        <div className={styles.field}>
          <label htmlFor="reset-email">회사 이메일</label>
          <input id="reset-email" type="email" autoComplete="email" {...emailForm.register('email')} aria-invalid={Boolean(emailForm.formState.errors.email)} aria-describedby={emailForm.formState.errors.email ? 'reset-email-error' : undefined} />
          {emailForm.formState.errors.email && <span id="reset-email-error" className={styles.error}>{emailForm.formState.errors.email.message}</span>}
        </div>
        {apiError && <p className={styles.errorBox} role="alert">{apiError}</p>}
        {requestSent && <p className={styles.description} role="status">등록된 이메일이라면 재설정 링크를 보냈어요. 계정이 등록되어 있는지는 알려 드릴 수 없어요.</p>}
        <Button
          block
          type="submit"
          disabled={request.isPending}
          aria-busy={request.isPending}
          pending={request.isPending}
          pendingLabel="요청 중…"
        >{requestSent ? '재설정 링크 다시 요청' : '재설정 링크 받기'}</Button>
      </form>}

      {Boolean(token) && tokenStatus.isPending && <div className={styles.form} role="status"><h2 className={styles.heading}>재설정 링크 확인 중</h2><p className={styles.description}>잠시만 기다려 주세요.</p></div>}
      {Boolean(token) && tokenStatus.isError && <div className={styles.form}>
        <h2 className={styles.heading}>링크를 확인하지 못했어요</h2>
        <p className={styles.errorBox} role="alert">{tokenStatus.error instanceof ApiError ? tokenStatus.error.message : '잠시 후 다시 시도해 주세요.'}</p>
        <Button asChild variant="outline"><Link href="/recruiter/reset">재설정 링크 다시 요청</Link></Button>
      </div>}
      {Boolean(token) && tokenStatus.isSuccess && !tokenStatus.data.valid && <div className={styles.form}>
        <h2 className={styles.heading}>링크가 만료됐어요</h2>
        <p className={styles.description}>비밀번호 재설정 링크는 30분 동안 한 번만 사용할 수 있어요. 새 링크를 요청해 주세요.</p>
        <Button asChild variant="outline"><Link href="/recruiter/reset">새 링크 요청</Link></Button>
      </div>}
      {Boolean(token) && tokenStatus.isSuccess && tokenStatus.data.valid && <form className={styles.form} noValidate onSubmit={passwordForm.handleSubmit((values) => { setApiError(null); reset.mutate(values); })}>
        <h2 className={styles.heading}>새 비밀번호 설정</h2>
        <PasswordField id="reset-password" label="새 비밀번호" error={passwordForm.formState.errors.password?.message} register={passwordForm.register('password')} />
        <PasswordField id="reset-password-confirm" label="새 비밀번호 확인" error={passwordForm.formState.errors.confirmPassword?.message} register={passwordForm.register('confirmPassword')} />
        <p className={styles.description}>비밀번호는 영문과 숫자를 포함해 {RECRUITER.password.min}~{RECRUITER.password.max}자로 입력해 주세요.</p>
        {apiError && <p className={styles.errorBox} role="alert">{apiError}</p>}
        <Button
          block
          type="submit"
          disabled={reset.isPending}
          aria-busy={reset.isPending}
          pending={reset.isPending}
          pendingLabel="저장 중…"
        >비밀번호 재설정</Button>
      </form>}

      <p className={styles.footer}><Link href="/recruiter/login">로그인으로 돌아가기</Link></p>
    </section>
  );
}

function PasswordField({ id, label, error, register }: { id: string; label: string; error?: string; register: import('react-hook-form').UseFormRegisterReturn }) {
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="password" autoComplete="new-password" {...register} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <span id={`${id}-error`} className={styles.error}>{error}</span>}
  </div>;
}
