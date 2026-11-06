'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';

import styles from '@/features/auth/recruiter-auth.module.css';
import { useRecruiterLoginForm } from './hook';

export function RecruiterLoginForm({ returnTo }: { returnTo: string }) {
  const { form, apiError, isPending, handlers } = useRecruiterLoginForm(returnTo);

  return (
    <section className={styles.container} aria-label="채용 담당자 로그인">
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit(handlers.onSubmit)}
      >
        <h2 className={styles.heading}>회사 계정으로 로그인</h2>
        <p className={styles.description}>회사 이메일과 비밀번호로 로그인해 주세요.</p>
        <div className={styles.field}>
          <label htmlFor="recruiter-email">회사 이메일</label>
          <input
            id="recruiter-email"
            type="email"
            autoComplete="username"
            {...form.register('email')}
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email ? 'recruiter-email-error' : undefined
            }
          />
          {form.formState.errors.email && (
            <span id="recruiter-email-error" className={styles.error}>
              {form.formState.errors.email.message}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="recruiter-password">비밀번호</label>
          <input
            id="recruiter-password"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password ? 'recruiter-password-error' : undefined
            }
          />
          {form.formState.errors.password && (
            <span id="recruiter-password-error" className={styles.error}>
              {form.formState.errors.password.message}
            </span>
          )}
        </div>
        {apiError && (
          <p className={styles.errorBox} role="alert">
            {apiError}
          </p>
        )}
        <Button block type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? '로그인 중…' : '로그인'}
        </Button>
        <nav className={styles.actionRow} aria-label="계정 도움말">
          <Link href="/recruiter/reset">비밀번호를 잊었어요</Link>
          <Link href="/recruiter/signup">채용 담당자 회원가입</Link>
        </nav>
      </form>
      <p className={styles.footer}>
        개발자 계정은 <Link href="/">GitHub로 시작</Link>에서 로그인해 주세요.
      </p>
    </section>
  );
}
