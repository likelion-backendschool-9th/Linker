'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useAccountSessionRefresh } from '@/features/auth/use-account-session-refresh';
import { ApiError } from '@/lib/api/api-error';
import { PROFILE } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';

import {
  saveOnboardingAgreements,
  saveOnboardingEmail,
  saveOnboardingProfile,
} from './api';

export const formSchema = z.object({
  termsAccepted: z.boolean().refine(Boolean, '이용약관에 동의해 주세요.'),
  privacyAccepted: z.boolean().refine(Boolean, '개인정보 처리방침에 동의해 주세요.'),
  marketingAccepted: z.boolean(),
  name: z
    .string()
    .trim()
    .min(PROFILE.displayName.min, '이름을 입력해 주세요.')
    .max(PROFILE.displayName.max, `이름은 ${PROFILE.displayName.max}자 이내로 입력해 주세요.`),
  bio: z.string().max(PROFILE.bioMax, `소개는 ${PROFILE.bioMax}자 이내로 입력해 주세요.`),
  blogUrl: z.string().refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, '블로그 주소는 https로 시작해야 해요.'),
  techStack: z.array(z.string()).max(PROFILE.techStackMax),
  lookingForTeam: z.boolean(),
  jobStatus: z.enum(['SEEKING', 'OPEN', 'OFF']),
  jobStatusChosen: z.boolean().refine(Boolean, '현재 구직 상태를 선택해 주세요.'),
  email: z.string(),
});

const notificationEmail = z.string().trim().email('올바른 이메일 주소를 입력해 주세요.');

export type FormValues = z.infer<typeof formSchema>;
export type OnboardingResponse = {
  done: boolean;
  step: 'AGREEMENTS' | 'PROFILE' | 'EMAIL';
  defaults: Pick<
    FormValues,
    'name' | 'bio' | 'blogUrl' | 'techStack' | 'lookingForTeam' | 'jobStatus'
  >;
  emailRequired: boolean;
  termsVersion: string;
};
export type TechTag = { id: number; name: string };

export function useOnboardingForm({
  initial,
  techStackMax,
}: {
  initial: OnboardingResponse;
  techStackMax: number;
}) {
  const router = useRouter();
  const refreshSession = useAccountSessionRefresh();
  const [step, setStep] = useState<'AGREEMENTS' | 'EMAIL' | 'PROFILE'>(
    initial.step === 'EMAIL' && initial.emailRequired
      ? 'EMAIL'
      : initial.step === 'AGREEMENTS'
        ? 'AGREEMENTS'
        : 'PROFILE',
  );
  const [pending, setPending] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const picker = useOverlay('tech-tags');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues: {
      ...initial.defaults,
      termsAccepted: false,
      privacyAccepted: false,
      marketingAccepted: false,
      email: '',
      name: '',
      bio: '',
      techStack: [],
      jobStatus: 'OFF',
      jobStatusChosen: false,
    },
  });
  const selectedTech = useWatch({ control: form.control, name: 'techStack' }) ?? [];
  const bioValue = useWatch({ control: form.control, name: 'bio' }) ?? '';

  async function continueToProfile() {
    const valid = await form.trigger(['termsAccepted', 'privacyAccepted'], {
      shouldFocus: true,
    });
    if (!valid) return;

    setPending(true);
    setApiError(null);
    try {
      await saveOnboardingAgreements({
        termsAccepted: form.getValues('termsAccepted'),
        privacyAccepted: form.getValues('privacyAccepted'),
        marketingAccepted: form.getValues('marketingAccepted'),
        termsVersion: initial.termsVersion,
      });
      setStep(initial.emailRequired ? 'EMAIL' : 'PROFILE');
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : '동의 내용을 저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setPending(false);
    }
  }

  async function saveEmail() {
    const parsed = notificationEmail.safeParse(form.getValues('email'));
    if (!parsed.success) {
      form.setError('email', { message: parsed.error.issues[0]?.message });
      form.setFocus('email');
      return;
    }
    setPending(true);
    setApiError(null);
    try {
      await saveOnboardingEmail(parsed.data);
      setStep('PROFILE');
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : '알림 이메일을 저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setPending(false);
    }
  }

  async function saveProfile(values: FormValues) {
    setPending(true);
    setApiError(null);
    try {
      await saveOnboardingProfile({
        name: values.name.trim(),
        bio: values.bio,
        blogUrl: values.blogUrl,
        techStack: values.techStack,
        lookingForTeam: values.lookingForTeam,
        jobStatus: values.jobStatus,
      });
      setComplete(true);
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : '프로필을 저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setPending(false);
    }
  }

  function toggleTechTag(name: string) {
    const current = form.getValues('techStack');
    if (current.includes(name)) {
      form.setValue(
        'techStack',
        current.filter((item) => item !== name),
        { shouldValidate: true },
      );
    } else if (current.length < techStackMax) {
      form.setValue('techStack', [...current, name], { shouldValidate: true });
    }
  }

  function goToFeed() {
    refreshSession();
    router.replace('/feed' as Route);
  }

  function goBackFromProfile() {
    setStep(initial.emailRequired ? 'EMAIL' : 'AGREEMENTS');
  }

  return {
    form,
    step,
    setStep,
    pending,
    apiError,
    complete,
    picker,
    selectedTech,
    bioValue,
    continueToProfile,
    saveEmail,
    saveProfile,
    toggleTechTag,
    goToFeed,
    goBackFromProfile,
    emailRequired: initial.emailRequired,
  };
}
