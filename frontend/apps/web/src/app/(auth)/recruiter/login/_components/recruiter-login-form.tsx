'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { safeReturnTo } from '@/lib/auth/return-to';

import styles from '@/features/auth/recruiter-auth.module.css';

const schema = z.object({
  email: z.string().trim().email('회사 이메일 형식을 확인해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});
type LoginValues = z.infer<typeof schema>;
type LoginResponse = { restored: boolean; returnTo: string };

export function RecruiterLoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(schema), mode: 'onSubmit', shouldFocusError: true, defaultValues: { email: '', password: '' } });
  const login = useMutation({
    mutationFn: (values: LoginValues) => apiFetch<LoginResponse>('/api/v1/public/recruiter-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: values.email.trim(), password: values.password, returnTo: safeReturnTo(returnTo) }),
    }),
    onSuccess: (result) => {
      setApiError(null);
      router.replace(safeReturnTo(result.returnTo) as Route);
      router.refresh();
    },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  return (
    <section className={styles.container} aria-label="채용 담당자 로그인">
      <form className={styles.form} noValidate onSubmit={form.handleSubmit((values) => { setApiError(null); login.mutate(values); })}>
        <h2 className={styles.heading}>회사 계정으로 로그인</h2>
        <p className={styles.description}>회사 이메일과 비밀번호로 로그인해 주세요.</p>
        <div className={styles.field}>
          <label htmlFor="recruiter-email">회사 이메일</label>
          <input id="recruiter-email" type="email" autoComplete="username" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'recruiter-email-error' : undefined} />
          {form.formState.errors.email && <span id="recruiter-email-error" className={styles.error}>{form.formState.errors.email.message}</span>}
        </div>
        <div className={styles.field}>
          <label htmlFor="recruiter-password">비밀번호</label>
          <input id="recruiter-password" type="password" autoComplete="current-password" {...form.register('password')} aria-invalid={Boolean(form.formState.errors.password)} aria-describedby={form.formState.errors.password ? 'recruiter-password-error' : undefined} />
          {form.formState.errors.password && <span id="recruiter-password-error" className={styles.error}>{form.formState.errors.password.message}</span>}
        </div>
        {apiError && <p className={styles.errorBox} role="alert">{apiError}</p>}
        <Button block type="submit" disabled={login.isPending} aria-busy={login.isPending}>{login.isPending ? '로그인 중…' : '로그인'}</Button>
        <nav className={styles.actionRow} aria-label="계정 도움말">
          <Link href="/recruiter/reset">비밀번호를 잊었어요</Link>
          <Link href="/recruiter/signup">채용 담당자 회원가입</Link>
        </nav>
      </form>
      <p className={styles.footer}>개발자 계정은 <Link href="/">GitHub로 시작</Link>에서 로그인해 주세요.</p>
    </section>
  );
}
