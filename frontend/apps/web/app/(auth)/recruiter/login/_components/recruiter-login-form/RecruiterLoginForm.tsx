'use client';

import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import styles from './RecruiterLoginForm.module.css';
import { useRecruiterLoginForm } from './hook';

export function RecruiterLoginForm({ returnTo }: { returnTo: string }) {
  const { form, apiError, isPending, handlers } = useRecruiterLoginForm(returnTo);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <section className={styles.stage} aria-label="채용 담당자 로그인">
      <div className={styles.brand}>
        <Image
          className={styles.logo}
          src="/textlogo.svg"
          alt=""
          width={191}
          height={64}
          priority
        />
        <p className={styles.tagline}>개발자 SNS의 새로운 패러다임</p>
      </div>

      <form className={styles.form} noValidate onSubmit={form.handleSubmit(handlers.onSubmit)}>
        <div className={styles.field}>
          <label className="sr-only" htmlFor="recruiter-email">
            회사 이메일
          </label>
          <input
            id="recruiter-email"
            type="email"
            autoComplete="username"
            placeholder="이메일"
            {...form.register('email')}
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={form.formState.errors.email ? 'recruiter-email-error' : undefined}
          />
          {form.formState.errors.email && (
            <span id="recruiter-email-error" className={styles.error}>
              {form.formState.errors.email.message}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className="sr-only" htmlFor="recruiter-password">
            비밀번호
          </label>
          <div className={styles.control}>
            <input
              id="recruiter-password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="비밀번호"
              {...form.register('password')}
              aria-invalid={Boolean(form.formState.errors.password)}
              aria-describedby={
                form.formState.errors.password ? 'recruiter-password-error' : undefined
              }
            />
            <button
              type="button"
              className={styles.reveal}
              aria-label={passwordVisible ? '비밀번호 숨기기' : '비밀번호 표시'}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
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

        <button type="submit" className={styles.submit} disabled={isPending} aria-busy={isPending}>
          {isPending ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <Link className={styles.signup} href="/recruiter/signup">
        비즈니스 회원가입
      </Link>
      <Link className={styles.forgot} href="/recruiter/reset">
        비밀번호를 잊었어요
      </Link>
    </section>
  );
}
