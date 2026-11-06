'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { ApiError } from '@/lib/api/api-error';
import { RECRUITER } from '@/lib/policy';

import styles from '@/features/auth/recruiter-auth.module.css';
import { useRecruiterResetFlow } from './hook';

export function RecruiterResetFlow({ token }: { token: string }) {
  const {
    emailForm,
    passwordForm,
    tokenStatus,
    requestSent,
    apiError,
    requestPending,
    resetPending,
    handlers,
  } = useRecruiterResetFlow(token);

  return (
    <section className={styles.container} aria-label="비밀번호 재설정">
      {!token && (
        <form
          className={styles.form}
          noValidate
          onSubmit={emailForm.handleSubmit(handlers.onRequestSubmit)}
        >
          <h2 className={styles.heading}>비밀번호를 잊으셨나요?</h2>
          <p className={styles.description}>
            가입한 회사 이메일을 입력하면 비밀번호 재설정 링크를 보내 드려요.
          </p>
          <div className={styles.field}>
            <label htmlFor="reset-email">회사 이메일</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              {...emailForm.register('email')}
              aria-invalid={Boolean(emailForm.formState.errors.email)}
              aria-describedby={
                emailForm.formState.errors.email ? 'reset-email-error' : undefined
              }
            />
            {emailForm.formState.errors.email && (
              <span id="reset-email-error" className={styles.error}>
                {emailForm.formState.errors.email.message}
              </span>
            )}
          </div>
          {apiError && (
            <p className={styles.errorBox} role="alert">
              {apiError}
            </p>
          )}
          {requestSent && (
            <p className={styles.description} role="status">
              등록된 이메일이라면 재설정 링크를 보냈어요. 계정이 등록되어 있는지는 알려 드릴 수
              없어요.
            </p>
          )}
          <Button block type="submit" disabled={requestPending} aria-busy={requestPending}>
            {requestPending
              ? '요청 중…'
              : requestSent
                ? '재설정 링크 다시 요청'
                : '재설정 링크 받기'}
          </Button>
        </form>
      )}

      {Boolean(token) && tokenStatus.isPending && (
        <div className={styles.form} role="status">
          <h2 className={styles.heading}>재설정 링크 확인 중</h2>
          <p className={styles.description}>잠시만 기다려 주세요.</p>
        </div>
      )}
      {Boolean(token) && tokenStatus.isError && (
        <div className={styles.form}>
          <h2 className={styles.heading}>링크를 확인하지 못했어요</h2>
          <p className={styles.errorBox} role="alert">
            {tokenStatus.error instanceof ApiError
              ? tokenStatus.error.message
              : '잠시 후 다시 시도해 주세요.'}
          </p>
          <Button asChild variant="outline">
            <Link href="/recruiter/reset">재설정 링크 다시 요청</Link>
          </Button>
        </div>
      )}
      {Boolean(token) && tokenStatus.isSuccess && !tokenStatus.data.valid && (
        <div className={styles.form}>
          <h2 className={styles.heading}>링크가 만료됐어요</h2>
          <p className={styles.description}>
            비밀번호 재설정 링크는 30분 동안 한 번만 사용할 수 있어요. 새 링크를 요청해 주세요.
          </p>
          <Button asChild variant="outline">
            <Link href="/recruiter/reset">새 링크 요청</Link>
          </Button>
        </div>
      )}
      {Boolean(token) && tokenStatus.isSuccess && tokenStatus.data.valid && (
        <form
          className={styles.form}
          noValidate
          onSubmit={passwordForm.handleSubmit(handlers.onResetSubmit)}
        >
          <h2 className={styles.heading}>새 비밀번호 설정</h2>
          <PasswordField
            id="reset-password"
            label="새 비밀번호"
            error={passwordForm.formState.errors.password?.message}
            register={passwordForm.register('password')}
          />
          <PasswordField
            id="reset-password-confirm"
            label="새 비밀번호 확인"
            error={passwordForm.formState.errors.confirmPassword?.message}
            register={passwordForm.register('confirmPassword')}
          />
          <p className={styles.description}>
            비밀번호는 영문과 숫자를 포함해 {RECRUITER.password.min}~{RECRUITER.password.max}자로
            입력해 주세요.
          </p>
          {apiError && (
            <p className={styles.errorBox} role="alert">
              {apiError}
            </p>
          )}
          <Button block type="submit" disabled={resetPending} aria-busy={resetPending}>
            {resetPending ? '저장 중…' : '비밀번호 재설정'}
          </Button>
        </form>
      )}

      <p className={styles.footer}>
        <Link href="/recruiter/login">로그인으로 돌아가기</Link>
      </p>
    </section>
  );
}

function PasswordField({
  id,
  label,
  error,
  register,
}: {
  id: string;
  label: string;
  error?: string;
  register: import('react-hook-form').UseFormRegisterReturn;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        {...register}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
