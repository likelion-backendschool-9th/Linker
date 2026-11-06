'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { TechTagPicker } from '@/features/profile/tech-tag-picker/TechTagPicker';
import { JobStatusPicker } from '@/features/profile/job-status-picker/JobStatusPicker';
import { PROFILE } from '@/lib/policy';

import {
  useOnboardingForm,
  type OnboardingResponse,
  type TechTag,
} from './hook';
import styles from './OnboardingForm.module.css';

export function OnboardingForm({
  initial,
  techTags,
  techStackMax,
}: {
  initial: OnboardingResponse;
  techTags: TechTag[];
  techStackMax: number;
}) {
  const {
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
    emailRequired,
  } = useOnboardingForm({ initial, techStackMax });

  if (complete) {
    return (
      <section className={styles.complete} aria-live="polite">
        <h2>프로필 설정이 완료됐어요</h2>
        <p>이제 Linker에서 프로젝트와 팀을 둘러볼 수 있어요.</p>
        <Button onClick={goToFeed}>피드로 이동</Button>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={form.handleSubmit(saveProfile)} noValidate>
      <ol className={styles.progress} aria-label="온보딩 단계">
        <li aria-current={step === 'AGREEMENTS' ? 'step' : undefined}>1. 약관 동의</li>
        {emailRequired && (
          <li aria-current={step === 'EMAIL' ? 'step' : undefined}>2. 알림 이메일</li>
        )}
        <li aria-current={step === 'PROFILE' ? 'step' : undefined}>
          {emailRequired ? '3. 기본 프로필' : '2. 기본 프로필'}
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
              onClick={goBackFromProfile}
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
