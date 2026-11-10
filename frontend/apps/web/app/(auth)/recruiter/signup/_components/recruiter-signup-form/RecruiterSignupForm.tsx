'use client';

import { CheckCircleLinearIcon } from '@solar-icons/static/linear/check-circle';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button/Button';
import { Icon } from '@/components/ui/icon';
import { RECRUITER } from '@/lib/policy';
import authStyles from '@/features/auth/recruiter-auth.module.css';

import { type FormValues, useRecruiterSignupForm } from './hook';
import pageStyles from './RecruiterSignupForm.module.css';

export function RecruiterSignupForm() {
  const {
    form,
    step,
    email,
    businessRegistrationNumber,
    codeSent,
    validMinutes,
    resendSeconds,
    apiError,
    checked,
    requestCodePending,
    verifyCodePending,
    signupPending,
    handlers,
  } = useRecruiterSignupForm();

  const requiredConsentsReady = Boolean(
    checked.ageConfirmed && checked.termsAccepted && checked.businessTermsAccepted,
  );
  const allConsentsChecked = Boolean(
    checked.ageConfirmed &&
      checked.termsAccepted &&
      checked.businessTermsAccepted &&
      checked.marketingAccepted,
  );

  if (step === 1) {
    return (
      <section className={pageStyles.screen} aria-label="채용 담당자 회원가입">
        <div className={pageStyles.stepper} role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={1} aria-label="회원가입 진행 단계">
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={index === 0 ? pageStyles.activeSegment : undefined}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className={pageStyles.content}>
          <div className={pageStyles.intro}>
            <h2>리크루터로 가입하기</h2>
            <p>개발자들의 작업물을 확인하고 채용으로 이어가세요</p>
          </div>

          <fieldset className={pageStyles.consents}>
            <legend className="sr-only">회원가입 약관 동의</legend>
            <label className={pageStyles.allConsent}>
              <input
                type="checkbox"
                checked={allConsentsChecked}
                onChange={(event) => handlers.setAllConsents(event.target.checked)}
              />
              <Icon svg={CheckCircleLinearIcon} />
              <span>약관 전체 동의</span>
            </label>

            <div className={pageStyles.consentList}>
              <Consent
                name="ageConfirmed"
                label="(필수) 만 19세 이상"
                href="/legal/terms"
                detailLabel="[ 자세히 보기 ]"
                register={form.register('ageConfirmed')}
                error={form.formState.errors.ageConfirmed?.message}
              />
              <Consent
                name="termsAccepted"
                label="(필수) 이용 약관"
                href="/legal/terms"
                detailLabel="[ 자세히 보기 ]"
                register={form.register('termsAccepted')}
                error={form.formState.errors.termsAccepted?.message}
              />
              <Consent
                name="businessTermsAccepted"
                label="(필수) 사업자 회원 약관 동의"
                href="/legal/recruiter-terms"
                detailLabel="[ 자세히 보기 ]"
                register={form.register('businessTermsAccepted', {
                  onChange: (event) => {
                    form.setValue('personalDataAccepted', event.target.checked);
                  },
                })}
                error={form.formState.errors.businessTermsAccepted?.message}
              />
              <Consent
                name="marketingAccepted"
                label="(선택) 마케팅 수신 동의"
                href="/legal/privacy"
                detailLabel="[ 자세히 보기 ]"
                register={form.register('marketingAccepted')}
              />
            </div>
          </fieldset>
        </div>

        <button
          type="button"
          className={pageStyles.next}
          disabled={!requiredConsentsReady}
          onClick={handlers.proceedFromConsents}
        >
          다음
        </button>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className={pageStyles.screen} aria-label="사업자 인증하기">
        <div
          className={pageStyles.stepper}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={6}
          aria-valuenow={2}
          aria-label="회원가입 진행 단계"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={index < 2 ? pageStyles.activeSegment : undefined}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className={pageStyles.content}>
          <div className={pageStyles.intro}>
            <h2>사업자 인증하기</h2>
            <p>사업자 등록 번호를 인증해 주세요.</p>
          </div>

          <div className={pageStyles.businessField}>
            <label htmlFor="business-registration-number">사업자 등록 번호</label>
            <div className={pageStyles.businessInput}>
              <input
                id="business-registration-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="사업자 등록번호 10자리를 작성해 주세요"
                value={businessRegistrationNumber}
                onChange={handlers.updateBusinessRegistrationNumber}
                aria-label="사업자 등록 번호"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          className={pageStyles.next}
          disabled={businessRegistrationNumber.length !== 10}
          onClick={handlers.proceedFromBusinessRegistration}
        >
          다음
        </button>
      </section>
    );
  }

  return (
    <section className={authStyles.container} aria-label="채용 담당자 회원가입">
      <ol className={authStyles.steps} aria-label="회원가입 단계">
        {(
          [
            ['사업자 등록 번호', 2],
            ['회사 이메일 인증', 3],
            ['계정 정보', 4],
          ] as const
        ).map(([label, number]) => (
          <li
            key={number}
            aria-current={step === number ? 'step' : undefined}
            className={step === number ? authStyles.currentStep : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
      {step === 3 && (
        <div className={authStyles.form}>
          <h2 className={authStyles.heading}>회사 이메일 인증</h2>
          <p className={authStyles.description}>
            회사 도메인의 이메일로 인증 코드를 보낼게요. 개인 메일은 사용할 수 없어요.
          </p>
          <Field id="company-email" label="회사 이메일" error={form.formState.errors.email?.message} styles={authStyles}>
            <input
              id="company-email"
              type="email"
              autoComplete="email"
              {...form.register('email', { onChange: handlers.updateEmail })}
              aria-invalid={Boolean(form.formState.errors.email)}
              aria-describedby={form.formState.errors.email ? 'company-email-error' : undefined}
            />
          </Field>
          <div className={authStyles.actionRow}>
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
              <p className={authStyles.description}>인증 코드는 {validMinutes}분 동안 유효해요.</p>
              <Field
                id="verification-code"
                label="인증 코드"
                error={form.formState.errors.code?.message}
                styles={authStyles}
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
          <Button variant="soft" onClick={() => handlers.goToStep(2)}>이전</Button>
        </div>
      )}

      {step === 4 && (
        <form className={authStyles.form} noValidate onSubmit={form.handleSubmit(handlers.submit)}>
          <h2 className={authStyles.heading}>담당자 및 회사 정보</h2>
          <p className={authStyles.description}>인증한 회사 이메일: {email}</p>
          <Field id="name" label="담당자 이름" error={form.formState.errors.name?.message} styles={authStyles}>
            <input
              id="name"
              autoComplete="name"
              maxLength={RECRUITER.name.max}
              {...form.register('name')}
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
            />
          </Field>
          <Field id="company" label="회사명" error={form.formState.errors.company?.message} styles={authStyles}>
            <input
              id="company"
              autoComplete="organization"
              maxLength={RECRUITER.company.max}
              {...form.register('company')}
              aria-invalid={Boolean(form.formState.errors.company)}
              aria-describedby={form.formState.errors.company ? 'company-error' : undefined}
            />
          </Field>
          <Field id="job-title" label="직책" error={form.formState.errors.jobTitle?.message} styles={authStyles}>
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
            styles={authStyles}
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
            styles={authStyles}
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
            styles={authStyles}
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
          {apiError && <ApiErrorNotice error={apiError} styles={authStyles} />}
          <div className={authStyles.actionRow}>
            <Button type="button" variant="soft" onClick={() => handlers.goToStep(3)}>
              이전
            </Button>
            <Button type="submit" disabled={signupPending} aria-busy={signupPending}>
              {signupPending ? '가입 중…' : '회원가입 완료'}
            </Button>
          </div>
        </form>
      )}

      {apiError && <ApiErrorNotice error={apiError} styles={authStyles} />}
      <p className={authStyles.footer}>
        이미 가입하셨나요? <Link href="/recruiter/login">로그인</Link>
      </p>
    </section>
  );
}

function Consent({
  name,
  label,
  href,
  detailLabel = '보기',
  register,
  error,
}: {
  name: keyof FormValues;
  label: string;
  href?: string;
  detailLabel?: string;
  register: ReturnType<ReturnType<typeof useForm<FormValues>>['register']>;
  error?: string;
}) {
  return (
    <div className={pageStyles.consent}>
      <label className={pageStyles.consentLabel}>
        <input
          type="checkbox"
          {...register}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <Icon svg={CheckCircleLinearIcon} />
        <span>{label}</span>
      </label>
      {href && (
        <Link
          href={href as Route}
          className={pageStyles.detail}
          aria-label={`${label} 자세히 보기`}
        >
          {detailLabel}
        </Link>
      )}
      {error && (
        <span id={`${name}-error`} className={pageStyles.error}>
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
  styles,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  styles: typeof authStyles;
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

function ApiErrorNotice({ error, styles }: { error: { message: string; code?: string }; styles: typeof authStyles }) {
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
