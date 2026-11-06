'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button/Button';
import { RECRUITER } from '@/lib/policy';
import styles from '@/features/auth/recruiter-auth.module.css';

import { type FormValues, useRecruiterSignupForm } from './hook';

export function RecruiterSignupForm() {
  const {
    form,
    step,
    email,
    codeSent,
    validMinutes,
    resendSeconds,
    apiError,
    requestCodePending,
    verifyCodePending,
    signupPending,
    handlers,
  } = useRecruiterSignupForm();

  return (
    <section className={styles.container} aria-label="채용 담당자 회원가입">
      <ol className={styles.steps} aria-label="회원가입 단계">
        {(
          [
            ['약관 동의', 1],
            ['회사 이메일 인증', 2],
            ['계정 정보', 3],
          ] as const
        ).map(([label, number]) => (
          <li
            key={number}
            aria-current={step === number ? 'step' : undefined}
            className={step === number ? styles.currentStep : undefined}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className={styles.form}>
          <h2 className={styles.heading}>기업회원 가입 동의</h2>
          <p className={styles.description}>
            채용 담당자 계정은 회사 이메일 인증 후 사용할 수 있어요.
          </p>
          <Button variant="outline" onClick={handlers.toggleAllConsents}>
            전체 동의 (선택 항목 포함)
          </Button>
          <Consent
            name="ageConfirmed"
            label="(필수) 만 19세 이상입니다"
            register={form.register('ageConfirmed')}
            error={form.formState.errors.ageConfirmed?.message}
          />
          <Consent
            name="termsAccepted"
            label="(필수) 서비스 이용약관 동의"
            href="/legal/terms"
            register={form.register('termsAccepted')}
            error={form.formState.errors.termsAccepted?.message}
          />
          <Consent
            name="businessTermsAccepted"
            label="(필수) 기업회원(채용 담당자) 추가약관 동의"
            href="/legal/recruiter-terms"
            register={form.register('businessTermsAccepted')}
            error={form.formState.errors.businessTermsAccepted?.message}
          />
          <Consent
            name="personalDataAccepted"
            label="(필수) 기업회원 개인정보 수집·이용 동의"
            href="/legal/privacy"
            register={form.register('personalDataAccepted')}
            error={form.formState.errors.personalDataAccepted?.message}
          />
          <Consent
            name="marketingAccepted"
            label="(선택) 마케팅 정보 수신 동의"
            register={form.register('marketingAccepted')}
          />
          <p className={styles.description}>
            개인정보 처리방침은 동의 항목이 아닌 안내 문서입니다.{' '}
            <Link href="/legal/privacy">개인정보 처리방침 보기</Link>
          </p>
          <Button block onClick={handlers.proceedFromConsents}>
            다음
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className={styles.form}>
          <h2 className={styles.heading}>회사 이메일 인증</h2>
          <p className={styles.description}>
            회사 도메인의 이메일로 인증 코드를 보낼게요. 개인 메일은 사용할 수 없어요.
          </p>
          <Field id="company-email" label="회사 이메일" error={form.formState.errors.email?.message}>
            <input
              id="company-email"
              type="email"
              autoComplete="email"
              {...form.register('email', { onChange: handlers.updateEmail })}
              aria-invalid={Boolean(form.formState.errors.email)}
              aria-describedby={form.formState.errors.email ? 'company-email-error' : undefined}
            />
          </Field>
          <div className={styles.actionRow}>
            <Button
              variant="outline"
              onClick={handlers.sendCode}
              disabled={requestCodePending || resendSeconds > 0}
            >
              {requestCodePending
                ? '보내는 중…'
                : codeSent
                  ? resendSeconds > 0
                    ? `인증 코드 다시 받기 (${resendSeconds}초)`
                    : '인증 코드 다시 받기'
                  : '인증 코드 받기'}
            </Button>
          </div>
          {codeSent && (
            <>
              <p className={styles.description}>인증 코드는 {validMinutes}분 동안 유효해요.</p>
              <Field
                id="verification-code"
                label="인증 코드"
                error={form.formState.errors.code?.message}
              >
                <input
                  id="verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={RECRUITER.emailCode.length}
                  {...form.register('code')}
                  aria-invalid={Boolean(form.formState.errors.code)}
                  aria-describedby={
                    form.formState.errors.code ? 'verification-code-error' : undefined
                  }
                />
              </Field>
              <Button block onClick={handlers.checkCode} disabled={verifyCodePending}>
                {verifyCodePending ? '확인 중…' : '이메일 인증하기'}
              </Button>
            </>
          )}
          <Button variant="soft" onClick={() => handlers.goToStep(1)}>
            이전
          </Button>
        </div>
      )}

      {step === 3 && (
        <form className={styles.form} noValidate onSubmit={form.handleSubmit(handlers.submit)}>
          <h2 className={styles.heading}>담당자 및 회사 정보</h2>
          <p className={styles.description}>인증한 회사 이메일: {email}</p>
          <Field id="name" label="담당자 이름" error={form.formState.errors.name?.message}>
            <input
              id="name"
              autoComplete="name"
              maxLength={RECRUITER.name.max}
              {...form.register('name')}
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
            />
          </Field>
          <Field id="company" label="회사명" error={form.formState.errors.company?.message}>
            <input
              id="company"
              autoComplete="organization"
              maxLength={RECRUITER.company.max}
              {...form.register('company')}
              aria-invalid={Boolean(form.formState.errors.company)}
              aria-describedby={form.formState.errors.company ? 'company-error' : undefined}
            />
          </Field>
          <Field id="job-title" label="직책" error={form.formState.errors.jobTitle?.message}>
            <input
              id="job-title"
              autoComplete="organization-title"
              maxLength={RECRUITER.jobTitle.max}
              {...form.register('jobTitle')}
              aria-invalid={Boolean(form.formState.errors.jobTitle)}
              aria-describedby={form.formState.errors.jobTitle ? 'job-title-error' : undefined}
            />
          </Field>
          <Field
            id="website"
            label="회사 웹사이트 (선택)"
            error={form.formState.errors.websiteUrl?.message}
          >
            <input
              id="website"
              type="url"
              inputMode="url"
              placeholder="https://example.com"
              {...form.register('websiteUrl')}
              aria-invalid={Boolean(form.formState.errors.websiteUrl)}
              aria-describedby={form.formState.errors.websiteUrl ? 'website-error' : undefined}
            />
          </Field>
          <Field
            id="password"
            label="비밀번호"
            hint={`영문과 숫자를 포함해 ${RECRUITER.password.min}~${RECRUITER.password.max}자로 입력해 주세요.`}
            error={form.formState.errors.password?.message}
          >
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={RECRUITER.password.min}
              maxLength={RECRUITER.password.max}
              {...form.register('password')}
              aria-invalid={Boolean(form.formState.errors.password)}
              aria-describedby={
                form.formState.errors.password ? 'password-error' : 'password-hint'
              }
            />
          </Field>
          <Field
            id="password-confirm"
            label="비밀번호 확인"
            error={form.formState.errors.passwordConfirm?.message}
          >
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              {...form.register('passwordConfirm')}
              aria-invalid={Boolean(form.formState.errors.passwordConfirm)}
              aria-describedby={
                form.formState.errors.passwordConfirm ? 'password-confirm-error' : undefined
              }
            />
          </Field>
          {apiError && <ApiErrorNotice error={apiError} />}
          <div className={styles.actionRow}>
            <Button type="button" variant="soft" onClick={() => handlers.goToStep(2)}>
              이전
            </Button>
            <Button type="submit" disabled={signupPending} aria-busy={signupPending}>
              {signupPending ? '가입 중…' : '회원가입 완료'}
            </Button>
          </div>
        </form>
      )}

      {step !== 3 && apiError && <ApiErrorNotice error={apiError} />}
      <p className={styles.footer}>
        이미 가입하셨나요? <Link href="/recruiter/login">로그인</Link>
      </p>
    </section>
  );
}

function Consent({
  name,
  label,
  href,
  register,
  error,
}: {
  name: keyof FormValues;
  label: string;
  href?: string;
  register: ReturnType<ReturnType<typeof useForm<FormValues>>['register']>;
  error?: string;
}) {
  return (
    <div className={styles.consent}>
      <label>
        <input
          type="checkbox"
          {...register}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span>{label}</span>
      </label>
      {href && <Link href={href as Route}>보기</Link>}
      {error && (
        <span id={`${name}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className={styles.description}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

function ApiErrorNotice({ error }: { error: { message: string; code?: string } }) {
  return (
    <div className={styles.errorBox} role="alert">
      <p>{error.message}</p>
      {error.code === 'EMAIL_TAKEN' && (
        <p>
          <Link href="/recruiter/login">로그인</Link> ·{' '}
          <Link href="/recruiter/reset">비밀번호 찾기</Link>
        </p>
      )}
    </div>
  );
}
