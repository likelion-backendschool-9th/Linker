'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { RECRUITER } from '@/lib/policy';
import { toast } from '@/stores/toast-store';
import styles from '@/features/auth/recruiter-auth.module.css';


const schema = z.object({
  ageConfirmed: z.boolean().refine(Boolean, '만 19세 이상인지 확인해 주세요.'),
  termsAccepted: z.boolean().refine(Boolean, '서비스 이용약관에 동의해 주세요.'),
  businessTermsAccepted: z.boolean().refine(Boolean, '기업회원 추가약관에 동의해 주세요.'),
  personalDataAccepted: z.boolean().refine(Boolean, '기업회원 개인정보 수집·이용에 동의해 주세요.'),
  marketingAccepted: z.boolean(),
  email: z.string().trim().email('올바른 회사 이메일을 입력해 주세요.'),
  code: z.string().length(RECRUITER.emailCode.length, `인증 코드는 ${RECRUITER.emailCode.length}자리예요.`),
  name: z.string().trim().min(RECRUITER.name.min, '담당자 이름을 입력해 주세요.').max(RECRUITER.name.max, `이름은 ${RECRUITER.name.max}자 이내로 입력해 주세요.`),
  company: z.string().trim().min(RECRUITER.company.min, '회사명을 입력해 주세요.').max(RECRUITER.company.max, `회사명은 ${RECRUITER.company.max}자 이내로 입력해 주세요.`),
  jobTitle: z.string().trim().min(RECRUITER.jobTitle.min, '직책을 입력해 주세요.').max(RECRUITER.jobTitle.max, `직책은 ${RECRUITER.jobTitle.max}자 이내로 입력해 주세요.`),
  websiteUrl: z.string().refine((value) => {
    if (!value) return true;
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, '회사 웹사이트는 https 주소로 입력해 주세요.'),
  password: z.string().min(RECRUITER.password.min, `비밀번호는 ${RECRUITER.password.min}자 이상 입력해 주세요.`).max(RECRUITER.password.max, `비밀번호는 ${RECRUITER.password.max}자 이내로 입력해 주세요.`).refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), '비밀번호에 영문과 숫자를 모두 포함해 주세요.'),
  passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
}).refine((values) => values.password === values.passwordConfirm, {
  path: ['passwordConfirm'],
  message: '비밀번호가 일치하지 않아요.',
});

type FormValues = z.infer<typeof schema>;
type EmailCodeResponse = { sent: boolean; resendAfterSeconds: number; validMinutes: number };
type VerifyResponse = { signupToken: string; emailDomain: string };

const defaultValues: FormValues = {
  ageConfirmed: false,
  termsAccepted: false,
  businessTermsAccepted: false,
  personalDataAccepted: false,
  marketingAccepted: false,
  email: '',
  code: '',
  name: '',
  company: '',
  jobTitle: '',
  websiteUrl: '',
  password: '',
  passwordConfirm: '',
};

export function RecruiterSignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [codeSent, setCodeSent] = useState(false);
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [validMinutes, setValidMinutes] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [apiError, setApiError] = useState<{ message: string; code?: string } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues,
  });
  const email = useWatch({ control: form.control, name: 'email' });
  const checked = useWatch({ control: form.control });

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const requestCode = useMutation({
    mutationFn: (companyEmail: string) => apiFetch<EmailCodeResponse>('/api/v1/public/recruiter-signup/email-codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: companyEmail }),
    }),
    onSuccess: (result) => {
      setCodeSent(true);
      setSignupToken(null);
      setValidMinutes(result.validMinutes);
      setResendSeconds(result.resendAfterSeconds);
      setApiError(null);
    },
    onError: (error) => setApiError(errorInfo(error, '인증 코드를 보내지 못했어요.')),
  });

  const verifyCode = useMutation({
    mutationFn: () => apiFetch<VerifyResponse>('/api/v1/public/recruiter-signup/email-codes/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), code: form.getValues('code') }),
    }),
    onSuccess: (result) => {
      setSignupToken(result.signupToken);
      setApiError(null);
      setStep(3);
    },
    onError: (error) => setApiError(errorInfo(error, '인증 코드를 확인하지 못했어요.')),
  });

  const signup = useMutation({
    mutationFn: (values: FormValues) => apiFetch<{ login: string }>('/api/v1/public/recruiter-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signupToken,
        password: values.password,
        name: values.name.trim(),
        company: values.company.trim(),
        jobTitle: values.jobTitle.trim(),
        websiteUrl: values.websiteUrl.trim() || null,
        consents: {
          ageConfirmed: values.ageConfirmed,
          termsAccepted: values.termsAccepted,
          businessTermsAccepted: values.businessTermsAccepted,
          personalDataAccepted: values.personalDataAccepted,
          marketingAccepted: values.marketingAccepted,
        },
      }),
    }),
    onSuccess: (result) => {
      toast(`채용 담당자 계정 @${result.login}을 만들었어요.`);
      router.replace('/feed');
    },
    onError: (error) => setApiError(errorInfo(error, '회원가입을 완료하지 못했어요. 다시 시도해 주세요.')),
  });

  async function proceedFromConsents() {
    const valid = await form.trigger(['ageConfirmed', 'termsAccepted', 'businessTermsAccepted', 'personalDataAccepted'], { shouldFocus: true });
    if (valid) { setApiError(null); setStep(2); }
  }

  async function sendCode() {
    if (!(await form.trigger('email', { shouldFocus: true }))) return;
    requestCode.mutate(email.trim());
  }

  async function checkCode() {
    if (!(await form.trigger(['email', 'code'], { shouldFocus: true }))) return;
    verifyCode.mutate();
  }

  function updateEmail(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.value !== email) {
      setCodeSent(false);
      setSignupToken(null);
      form.setValue('code', '');
    }
  }

  function submit(values: FormValues) {
    if (!signupToken) {
      setApiError({ message: '회사 이메일 인증을 먼저 완료해 주세요.' });
      setStep(2);
      return;
    }
    setApiError(null);
    signup.mutate(values);
  }

  return (
    <section className={styles.container} aria-label="채용 담당자 회원가입">
      <ol className={styles.steps} aria-label="회원가입 단계">
        {[['약관 동의', 1], ['회사 이메일 인증', 2], ['계정 정보', 3]].map(([label, number]) => (
          <li key={number} aria-current={step === number ? 'step' : undefined} className={step === number ? styles.currentStep : undefined}>{label}</li>
        ))}
      </ol>

      {step === 1 && <div className={styles.form}>
        <h2 className={styles.heading}>기업회원 가입 동의</h2>
        <p className={styles.description}>채용 담당자 계정은 회사 이메일 인증 후 사용할 수 있어요.</p>
        <Button variant="outline" onClick={() => {
          const all = !checked.ageConfirmed || !checked.termsAccepted || !checked.businessTermsAccepted || !checked.personalDataAccepted || !checked.marketingAccepted;
          for (const field of ['ageConfirmed', 'termsAccepted', 'businessTermsAccepted', 'personalDataAccepted', 'marketingAccepted'] as const) form.setValue(field, all, { shouldValidate: true });
        }}>전체 동의 (선택 항목 포함)</Button>
        <Consent name="ageConfirmed" label="(필수) 만 19세 이상입니다" register={form.register('ageConfirmed')} error={form.formState.errors.ageConfirmed?.message} />
        <Consent name="termsAccepted" label="(필수) 서비스 이용약관 동의" href="/legal/terms" register={form.register('termsAccepted')} error={form.formState.errors.termsAccepted?.message} />
        <Consent name="businessTermsAccepted" label="(필수) 기업회원(채용 담당자) 추가약관 동의" href="/legal/recruiter-terms" register={form.register('businessTermsAccepted')} error={form.formState.errors.businessTermsAccepted?.message} />
        <Consent name="personalDataAccepted" label="(필수) 기업회원 개인정보 수집·이용 동의" href="/legal/privacy" register={form.register('personalDataAccepted')} error={form.formState.errors.personalDataAccepted?.message} />
        <Consent name="marketingAccepted" label="(선택) 마케팅 정보 수신 동의" register={form.register('marketingAccepted')} />
        <p className={styles.description}>개인정보 처리방침은 동의 항목이 아닌 안내 문서입니다. <Link href="/legal/privacy">개인정보 처리방침 보기</Link></p>
        <Button block onClick={proceedFromConsents}>다음</Button>
      </div>}

      {step === 2 && <div className={styles.form}>
        <h2 className={styles.heading}>회사 이메일 인증</h2>
        <p className={styles.description}>회사 도메인의 이메일로 인증 코드를 보낼게요. 개인 메일은 사용할 수 없어요.</p>
        <Field id="company-email" label="회사 이메일" error={form.formState.errors.email?.message}>
          <input id="company-email" type="email" autoComplete="email" {...form.register('email', { onChange: updateEmail })} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'company-email-error' : undefined} />
        </Field>
        <div className={styles.actionRow}>
          <Button
            variant="outline"
            onClick={sendCode}
            disabled={requestCode.isPending || resendSeconds > 0}
            pending={requestCode.isPending}
            pendingLabel="보내는 중…"
          >{codeSent ? resendSeconds > 0 ? `인증 코드 다시 받기 (${resendSeconds}초)` : '인증 코드 다시 받기' : '인증 코드 받기'}</Button>
        </div>
        {codeSent && <>
          <p className={styles.description}>인증 코드는 {validMinutes}분 동안 유효해요.</p>
          <Field id="verification-code" label="인증 코드" error={form.formState.errors.code?.message}>
            <input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={RECRUITER.emailCode.length} {...form.register('code')} aria-invalid={Boolean(form.formState.errors.code)} aria-describedby={form.formState.errors.code ? 'verification-code-error' : undefined} />
          </Field>
          <Button
            block
            onClick={checkCode}
            disabled={verifyCode.isPending}
            pending={verifyCode.isPending}
            pendingLabel="확인 중…"
          >이메일 인증하기</Button>
        </>}
        <Button variant="soft" onClick={() => { setApiError(null); setStep(1); }}>이전</Button>
      </div>}

      {step === 3 && <form className={styles.form} noValidate onSubmit={form.handleSubmit(submit)}>
        <h2 className={styles.heading}>담당자 및 회사 정보</h2>
        <p className={styles.description}>인증한 회사 이메일: {email}</p>
        <Field id="name" label="담당자 이름" error={form.formState.errors.name?.message}><input id="name" autoComplete="name" maxLength={RECRUITER.name.max} {...form.register('name')} aria-invalid={Boolean(form.formState.errors.name)} aria-describedby={form.formState.errors.name ? 'name-error' : undefined} /></Field>
        <Field id="company" label="회사명" error={form.formState.errors.company?.message}><input id="company" autoComplete="organization" maxLength={RECRUITER.company.max} {...form.register('company')} aria-invalid={Boolean(form.formState.errors.company)} aria-describedby={form.formState.errors.company ? 'company-error' : undefined} /></Field>
        <Field id="job-title" label="직책" error={form.formState.errors.jobTitle?.message}><input id="job-title" autoComplete="organization-title" maxLength={RECRUITER.jobTitle.max} {...form.register('jobTitle')} aria-invalid={Boolean(form.formState.errors.jobTitle)} aria-describedby={form.formState.errors.jobTitle ? 'job-title-error' : undefined} /></Field>
        <Field id="website" label="회사 웹사이트 (선택)" error={form.formState.errors.websiteUrl?.message}><input id="website" type="url" inputMode="url" placeholder="https://example.com" {...form.register('websiteUrl')} aria-invalid={Boolean(form.formState.errors.websiteUrl)} aria-describedby={form.formState.errors.websiteUrl ? 'website-error' : undefined} /></Field>
        <Field id="password" label="비밀번호" hint={`영문과 숫자를 포함해 ${RECRUITER.password.min}~${RECRUITER.password.max}자로 입력해 주세요.`} error={form.formState.errors.password?.message}><input id="password" type="password" autoComplete="new-password" minLength={RECRUITER.password.min} maxLength={RECRUITER.password.max} {...form.register('password')} aria-invalid={Boolean(form.formState.errors.password)} aria-describedby={form.formState.errors.password ? 'password-error' : 'password-hint'} /></Field>
        <Field id="password-confirm" label="비밀번호 확인" error={form.formState.errors.passwordConfirm?.message}><input id="password-confirm" type="password" autoComplete="new-password" {...form.register('passwordConfirm')} aria-invalid={Boolean(form.formState.errors.passwordConfirm)} aria-describedby={form.formState.errors.passwordConfirm ? 'password-confirm-error' : undefined} /></Field>
        {apiError && <ApiErrorNotice error={apiError} />}
        <div className={styles.actionRow}>
          <Button type="button" variant="soft" onClick={() => { setApiError(null); setStep(2); }}>이전</Button>
          <Button
            type="submit"
            disabled={signup.isPending}
            aria-busy={signup.isPending}
            pending={signup.isPending}
            pendingLabel="가입 중…"
          >회원가입 완료</Button>
        </div>
      </form>}

      {step !== 3 && apiError && <ApiErrorNotice error={apiError} />}
      <p className={styles.footer}>이미 가입하셨나요? <Link href="/recruiter/login">로그인</Link></p>
    </section>
  );
}

function Consent({ name, label, href, register, error }: { name: keyof FormValues; label: string; href?: string; register: ReturnType<ReturnType<typeof useForm<FormValues>>['register']>; error?: string }) {
  return <div className={styles.consent}>
    <label><input type="checkbox" {...register} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} /><span>{label}</span></label>
    {href && <Link href={href as Route}>보기</Link>}
    {error && <span id={`${name}-error`} className={styles.error}>{error}</span>}
  </div>;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <span id={`${id}-hint`} className={styles.description}>{hint}</span>}
    {error && <span id={`${id}-error`} className={styles.error}>{error}</span>}
  </div>;
}

function ApiErrorNotice({ error }: { error: { message: string; code?: string } }) {
  return <div className={styles.errorBox} role="alert">
    <p>{error.message}</p>
    {error.code === 'EMAIL_TAKEN' && <p><Link href="/recruiter/login">로그인</Link> · <Link href="/recruiter/reset">비밀번호 찾기</Link></p>}
  </div>;
}

function errorInfo(error: unknown, fallback: string) {
  return error instanceof ApiError ? { message: error.message, code: error.code } : { message: fallback };
}
