'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { saveNativeSession } from '@/features/auth/sync-native-session';
import { useAccountSessionRefresh } from '@/features/auth/use-account-session-refresh';
import { ApiError } from '@/lib/api/api-error';
import { RECRUITER } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import {
  completeRecruiterSignup,
  requestSignupEmailCode,
  verifySignupEmailCode,
} from './api';

export const signupSchema = z
  .object({
    ageConfirmed: z.boolean().refine(Boolean, '만 19세 이상인지 확인해 주세요.'),
    termsAccepted: z.boolean().refine(Boolean, '서비스 이용약관에 동의해 주세요.'),
    businessTermsAccepted: z
      .boolean()
      .refine(Boolean, '기업회원 추가약관에 동의해 주세요.'),
    personalDataAccepted: z
      .boolean()
      .refine(Boolean, '기업회원 개인정보 수집·이용에 동의해 주세요.'),
    marketingAccepted: z.boolean(),
    email: z.string().trim().email('올바른 회사 이메일을 입력해 주세요.'),
    code: z
      .string()
      .length(RECRUITER.emailCode.length, `인증 코드는 ${RECRUITER.emailCode.length}자리예요.`),
    name: z
      .string()
      .trim()
      .min(RECRUITER.name.min, '담당자 이름을 입력해 주세요.')
      .max(RECRUITER.name.max, `이름은 ${RECRUITER.name.max}자 이내로 입력해 주세요.`),
    company: z
      .string()
      .trim()
      .min(RECRUITER.company.min, '회사명을 입력해 주세요.')
      .max(RECRUITER.company.max, `회사명은 ${RECRUITER.company.max}자 이내로 입력해 주세요.`),
    jobTitle: z
      .string()
      .trim()
      .min(RECRUITER.jobTitle.min, '직책을 입력해 주세요.')
      .max(RECRUITER.jobTitle.max, `직책은 ${RECRUITER.jobTitle.max}자 이내로 입력해 주세요.`),
    websiteUrl: z.string().refine((value) => {
      if (!value) return true;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }, '회사 웹사이트는 https 주소로 입력해 주세요.'),
    password: z
      .string()
      .min(RECRUITER.password.min, `비밀번호는 ${RECRUITER.password.min}자 이상 입력해 주세요.`)
      .max(RECRUITER.password.max, `비밀번호는 ${RECRUITER.password.max}자 이내로 입력해 주세요.`)
      .refine(
        (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
        '비밀번호에 영문과 숫자를 모두 포함해 주세요.',
      ),
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않아요.',
  });

export type FormValues = z.infer<typeof signupSchema>;

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

function errorInfo(error: unknown, fallback: string) {
  return error instanceof ApiError
    ? { message: error.message, code: error.code }
    : { message: fallback };
}

export function useRecruiterSignupForm() {
  const router = useRouter();
  const refreshSession = useAccountSessionRefresh();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [validMinutes, setValidMinutes] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [apiError, setApiError] = useState<{ message: string; code?: string } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues,
  });
  const email = useWatch({ control: form.control, name: 'email' });
  const checked = useWatch({ control: form.control });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const requestCode = useMutation({
    mutationFn: (companyEmail: string) => requestSignupEmailCode(companyEmail),
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
    mutationFn: () => verifySignupEmailCode(email, form.getValues('code')),
    onSuccess: (result) => {
      setSignupToken(result.signupToken);
      setApiError(null);
      setStep(4);
    },
    onError: (error) => setApiError(errorInfo(error, '인증 코드를 확인하지 못했어요.')),
  });

  const signup = useMutation({
    mutationFn: (values: FormValues) =>
      completeRecruiterSignup({
        signupToken,
        password: values.password,
        name: values.name,
        company: values.company,
        jobTitle: values.jobTitle,
        websiteUrl: values.websiteUrl,
        consents: {
          ageConfirmed: values.ageConfirmed,
          termsAccepted: values.termsAccepted,
          businessTermsAccepted: values.businessTermsAccepted,
          personalDataAccepted: values.personalDataAccepted,
          marketingAccepted: values.marketingAccepted,
        },
      }),
    onSuccess: async (result) => {
      toast(`채용 담당자 계정 @${result.login}을 만들었어요.`);
      try {
        await saveNativeSession();
      } catch {
        // Web signup still succeeds if the native session sync fails.
      }
      refreshSession();
      router.replace('/feed');
    },
    onError: (error) =>
      setApiError(errorInfo(error, '회원가입을 완료하지 못했어요. 다시 시도해 주세요.')),
  });

  async function proceedFromConsents() {
    const valid = await form.trigger(
      ['ageConfirmed', 'termsAccepted', 'businessTermsAccepted', 'personalDataAccepted'],
      { shouldFocus: true },
    );
    if (valid) {
      setApiError(null);
      setStep(2);
    }
  }

  function updateBusinessRegistrationNumber(event: ChangeEvent<HTMLInputElement>) {
    setBusinessRegistrationNumber(event.target.value.replace(/\D/g, '').slice(0, 10));
  }

  function proceedFromBusinessRegistration() {
    if (businessRegistrationNumber.length !== 10) return;
    setApiError(null);
    setStep(3);
  }

  async function sendCode() {
    if (!(await form.trigger('email', { shouldFocus: true }))) return;
    requestCode.mutate(email.trim());
  }

  async function checkCode() {
    if (!(await form.trigger(['email', 'code'], { shouldFocus: true }))) return;
    verifyCode.mutate();
  }

  function updateEmail(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.value !== email) {
      setCodeSent(false);
      setSignupToken(null);
      form.setValue('code', '');
    }
  }

  function submit(values: FormValues) {
    if (!signupToken) {
      setApiError({ message: '회사 이메일 인증을 먼저 완료해 주세요.' });
      setStep(3);
      return;
    }
    setApiError(null);
    signup.mutate(values);
  }

  function setAllConsents(checkedValue: boolean) {
    for (const field of [
      'ageConfirmed',
      'termsAccepted',
      'businessTermsAccepted',
      'personalDataAccepted',
      'marketingAccepted',
    ] as const) {
      form.setValue(field, checkedValue);
    }
  }

  function goToStep(next: 1 | 2 | 3 | 4) {
    setApiError(null);
    setStep(next);
  }

  return {
    form,
    step,
    checked,
    businessRegistrationNumber,
    email,
    codeSent,
    validMinutes,
    resendSeconds,
    apiError,
    requestCodePending: requestCode.isPending,
    verifyCodePending: verifyCode.isPending,
    signupPending: signup.isPending,
    handlers: {
      proceedFromConsents,
      updateBusinessRegistrationNumber,
      proceedFromBusinessRegistration,
      sendCode,
      checkCode,
      updateEmail,
      submit,
      setAllConsents,
      goToStep,
    },
  };
}
