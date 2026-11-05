'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { TechTagPicker } from '@/features/profile/tech-tag-picker';
import { JobStatusPicker } from '@/features/profile/job-status-picker';
import { useAccountSessionRefresh } from '@/features/auth/use-account-session-refresh';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { PROFILE } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './onboarding-form.module.css';

const formSchema = z.object({
  ageConfirmed: z.boolean().refine(Boolean, '만 14세 이상인지 확인해 주세요.'),
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
  email: z.string(),
});

const notificationEmail = z.string().trim().email('올바른 이메일 주소를 입력해 주세요.');

type FormValues = z.infer<typeof formSchema>;
type OnboardingResponse = {
  done: boolean;
  step: 'AGREEMENTS' | 'PROFILE' | 'EMAIL';
  defaults: Pick<
    FormValues,
    'name' | 'bio' | 'blogUrl' | 'techStack' | 'lookingForTeam' | 'jobStatus'
  >;
  emailRequired: boolean;
  termsVersion: string;
};
type TechTag = { id: number; name: string };

export function OnboardingForm({
  initial,
  techTags,
  techStackMax,
}: {
  initial: OnboardingResponse;
  techTags: TechTag[];
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
      ageConfirmed: false,
      termsAccepted: false,
      privacyAccepted: false,
      marketingAccepted: false,
      email: '',
      ...initial.defaults,
    },
  });
  const selectedTech = useWatch({ control: form.control, name: 'techStack' }) ?? [];
  const bioValue = useWatch({ control: form.control, name: 'bio' }) ?? '';

  async function continueToProfile() {
    const valid = await form.trigger(['ageConfirmed', 'termsAccepted', 'privacyAccepted'], {
      shouldFocus: true,
    });
    if (!valid) return;

    setPending(true);
    setApiError(null);
    try {
      await apiFetch('/api/v1/user/onboarding/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ageConfirmed: form.getValues('ageConfirmed'),
          termsAccepted: form.getValues('termsAccepted'),
          privacyAccepted: form.getValues('privacyAccepted'),
          marketingAccepted: form.getValues('marketingAccepted'),
          termsVersion: initial.termsVersion,
        }),
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
      await apiFetch('/api/v1/user/onboarding/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data }),
      });
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
      await apiFetch('/api/v1/user/onboarding/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          bio: values.bio,
          blogUrl: values.blogUrl,
          techStack: values.techStack,
          lookingForTeam: values.lookingForTeam,
          jobStatus: values.jobStatus,
        }),
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

  if (complete) {
    return (
      <section className={styles.complete} aria-live="polite">
        <h2>프로필 설정이 완료됐어요</h2>
        <p>이제 Linker에서 프로젝트와 팀을 둘러볼 수 있어요.</p>
        <Button
          onClick={() => {
            refreshSession();
            router.replace('/feed' as Route);
          }}
        >
          피드로 이동
        </Button>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={form.handleSubmit(saveProfile)} noValidate>
      <ol className={styles.progress} aria-label="온보딩 단계">
        <li aria-current={step === 'AGREEMENTS' ? 'step' : undefined}>1. 약관 동의</li>
        {initial.emailRequired && (
          <li aria-current={step === 'EMAIL' ? 'step' : undefined}>2. 알림 이메일</li>
        )}
        <li aria-current={step === 'PROFILE' ? 'step' : undefined}>
          {initial.emailRequired ? '3. 기본 프로필' : '2. 기본 프로필'}
        </li>
      </ol>

      {step === 'AGREEMENTS' ? (
        <fieldset className={styles.fieldset} disabled={pending}>
          <legend>서비스 이용 동의</legend>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              {...form.register('ageConfirmed')}
              aria-invalid={!!form.formState.errors.ageConfirmed}
              aria-describedby={form.formState.errors.ageConfirmed ? 'age-error' : undefined}
            />
            <span>
              만 14세 이상입니다. <span aria-hidden="true">(필수)</span>
            </span>
          </label>
          {form.formState.errors.ageConfirmed && (
            <FieldError id="age-error">{form.formState.errors.ageConfirmed.message}</FieldError>
          )}

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              {...form.register('termsAccepted')}
              aria-invalid={!!form.formState.errors.termsAccepted}
              aria-describedby={form.formState.errors.termsAccepted ? 'terms-error' : undefined}
            />
            <span>
              <Link href="/legal/terms">이용약관</Link>에 동의합니다.{' '}
              <span aria-hidden="true">(필수)</span>
            </span>
          </label>
          {form.formState.errors.termsAccepted && (
            <FieldError id="terms-error">{form.formState.errors.termsAccepted.message}</FieldError>
          )}

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              {...form.register('privacyAccepted')}
              aria-invalid={!!form.formState.errors.privacyAccepted}
              aria-describedby={form.formState.errors.privacyAccepted ? 'privacy-error' : undefined}
            />
            <span>
              <Link href="/legal/privacy">개인정보 처리방침</Link>에 동의합니다.{' '}
              <span aria-hidden="true">(필수)</span>
            </span>
          </label>
          {form.formState.errors.privacyAccepted && (
            <FieldError id="privacy-error">
              {form.formState.errors.privacyAccepted.message}
            </FieldError>
          )}

          <label className={styles.checkbox}>
            <input type="checkbox" {...form.register('marketingAccepted')} />
            <span>마케팅 정보 수신에 동의합니다. (선택)</span>
          </label>
          <Button
            type="button"
            block
            onClick={continueToProfile}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? '저장 중…' : '다음'}
          </Button>
        </fieldset>
      ) : step === 'EMAIL' ? (
        <fieldset className={styles.fieldset} disabled={pending}>
          <legend>알림 이메일</legend>
          <p className={styles.help}>프로필에는 표시되지 않아요. 계정 안내와 알림을 받는 주소예요.</p>
          <div className={styles.field}>
            <label htmlFor="notification-email">알림 이메일</label>
            <input
              id="notification-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register('email')}
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            />
            {form.formState.errors.email && (
              <FieldError id="email-error">{form.formState.errors.email.message}</FieldError>
            )}
          </div>
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={() => setStep('AGREEMENTS')} disabled={pending}>
              이전
            </Button>
            <Button type="button" onClick={saveEmail} disabled={pending} aria-busy={pending}>
              {pending ? '저장 중…' : '다음'}
            </Button>
          </div>
        </fieldset>
      ) : (
        <section className={styles.profile} aria-labelledby="profile-step-title">
          <h2 id="profile-step-title">기본 프로필을 확인해 주세요</h2>
          <p className={styles.help}>GitHub에서 가져온 정보예요. 필요한 내용을 수정할 수 있어요.</p>

          <div className={styles.field}>
            <label htmlFor="display-name">이름</label>
            <input
              id="display-name"
              autoComplete="name"
              {...form.register('name')}
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
            />
            {form.formState.errors.name && (
              <FieldError id="name-error">{form.formState.errors.name.message}</FieldError>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="bio">소개</label>
            <textarea
              id="bio"
              rows={4}
              {...form.register('bio')}
              aria-invalid={!!form.formState.errors.bio}
              aria-describedby={form.formState.errors.bio ? 'bio-error' : 'bio-count'}
            />
            <span id="bio-count" className={styles.help}>
              {bioValue.length}/{PROFILE.bioMax}
            </span>
            {form.formState.errors.bio && (
              <FieldError id="bio-error">{form.formState.errors.bio.message}</FieldError>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="blog-url">블로그 주소</label>
            <input
              id="blog-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              {...form.register('blogUrl')}
              aria-invalid={!!form.formState.errors.blogUrl}
              aria-describedby={form.formState.errors.blogUrl ? 'blog-error' : undefined}
            />
            {form.formState.errors.blogUrl && (
              <FieldError id="blog-error">{form.formState.errors.blogUrl.message}</FieldError>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>기술 스택</span>
            <p className={styles.help}>
              {selectedTech.length}/{techStackMax}개 선택
            </p>
            <ul className={styles.chips} aria-label="선택한 기술 스택">
              {selectedTech.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={() => picker.open()}>
              기술 스택 선택
            </Button>
          </div>

          <label className={styles.checkbox}>
            <input type="checkbox" {...form.register('lookingForTeam')} />
            <span>함께할 팀을 찾고 있어요</span>
          </label>

          <JobStatusPicker register={form.register('jobStatus')} disabled={pending} />

          <div className={styles.actions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(initial.emailRequired ? 'EMAIL' : 'AGREEMENTS')}
              disabled={pending}
            >
              이전
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? '저장 중…' : '완료'}
            </Button>
          </div>
        </section>
      )}

      {apiError && (
        <p className={styles.apiError} role="alert">
          {apiError}
        </p>
      )}

      <TechTagPicker
        overlay={picker}
        tags={techTags}
        selected={selectedTech}
        max={techStackMax}
        onToggle={toggleTechTag}
      />
    </form>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return (
    <span id={id} className={styles.fieldError} role="alert">
      {children}
    </span>
  );
}
