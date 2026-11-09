'use client';

import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

import headerStyles from '@/components/layout/header.module.css';
import { BackButton } from '@/components/layout/back-button';
import { SkipLink } from '@/components/layout/skip-link';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { TechTagPicker } from '@/features/profile/tech-tag-picker/TechTagPicker';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';
import { useOverlay } from '@/lib/navigation/use-overlay';

import {
  useOnboardingForm,
  type OnboardingResponse,
  type TechTag,
} from './hook';
import styles from './OnboardingForm.module.css';

const JOB_OPTIONS = [
  { value: 'SEEKING', label: '구직 중' },
  { value: 'OPEN', label: '제안만 받기' },
  { value: 'OFF', label: '끔' },
] as const;

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
    continueToProfile,
    saveEmail,
    saveProfile,
    toggleTechTag,
    goToFeed,
    goBackFromProfile,
  } = useOnboardingForm({ initial, techStackMax });
  const jobSheet = useOverlay('onboarding-job-status');
  const [termsAccepted, privacyAccepted, marketingAccepted, name, email, jobStatus, jobStatusChosen] =
    useWatch({
      control: form.control,
      name: [
        'termsAccepted',
        'privacyAccepted',
        'marketingAccepted',
        'name',
        'email',
        'jobStatus',
        'jobStatusChosen',
      ],
    });
  const consentsReady = Boolean(termsAccepted && privacyAccepted);
  const allChecked = consentsReady && Boolean(marketingAccepted);
  const jobLabel = JOB_OPTIONS.find((option) => option.value === jobStatus)?.label ?? '끔';
  const title =
    step === 'AGREEMENTS' ? '약관 동의' : step === 'EMAIL' ? '이메일 입력' : '기본 프로필 설정';
  const footerReady =
    step === 'AGREEMENTS'
      ? consentsReady
      : step === 'EMAIL'
        ? email.trim().length > 0
        : name.trim().length > 0 && jobStatusChosen;

  function toggleAll(checked: boolean) {
    form.setValue('termsAccepted', checked);
    form.setValue('privacyAccepted', checked);
    form.setValue('marketingAccepted', checked);
  }

  return (
    <div className={styles.screen}>
      <SkipLink />
      <header className={headerStyles.header}>
        <div className={headerStyles.inner}>
          {complete ? null : step === 'AGREEMENTS' ? (
            <BackButton fallbackHref="/feed" />
          ) : (
            <button
              type="button"
              className={headerStyles.iconButton}
              onClick={step === 'EMAIL' ? () => setStep('AGREEMENTS') : goBackFromProfile}
            >
              <ArrowLeft aria-hidden className={headerStyles.backIcon} />
              <span className="sr-only">뒤로</span>
            </button>
          )}
          <h1 id="page-title" className={headerStyles.title}>
            {title}
          </h1>
        </div>
      </header>
      <main id="main" tabIndex={-1} aria-labelledby="page-title" className={styles.main}>
        <StatusBanners />
        {complete ? (
          <div className={styles.complete}>
            <div className={styles.body}>
              <h2>프로필 설정이 완료됐어요</h2>
              <p className={styles.help}>이제 Linker에서 프로젝트와 팀을 둘러볼 수 있어요.</p>
            </div>
            <div className={styles.footer}>
              <button type="button" className={`${styles.next} ${styles.nextReady}`} onClick={goToFeed}>
                피드로 이동
              </button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={form.handleSubmit(saveProfile)} noValidate>
            <div
              className={`${styles.body} ${step === 'AGREEMENTS' ? styles.agreementsBody : ''} ${step === 'PROFILE' ? styles.profileBody : ''}`}
            >
              {step === 'AGREEMENTS' ? (
                <>
                  <div className={styles.intro}>
                    <h2>이용 약관에 동의를 해주세요</h2>
                    <p>서비스를 사용하기 전 약관에 동의 해주세요</p>
                  </div>
                  <fieldset className={styles.consents} disabled={pending}>
                    <legend className="sr-only">서비스 이용 동의</legend>
                    <label className={styles.consent}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(event) => toggleAll(event.target.checked)}
                      />
                      <CircleMark />
                      <span>약관 전체 동의</span>
                    </label>
                    <div className={styles.consentList}>
                      <ConsentRow
                        label="(필수) 이용 약관"
                        accessibleName="이용약관에 동의합니다"
                        href="/legal/terms"
                        inputProps={form.register('termsAccepted')}
                        invalid={!!form.formState.errors.termsAccepted}
                        errorId="terms-error"
                        error={form.formState.errors.termsAccepted?.message}
                      />
                      <ConsentRow
                        label="(필수) 개인정보 처리방침"
                        accessibleName="개인정보 처리방침에 동의합니다"
                        href="/legal/privacy"
                        inputProps={form.register('privacyAccepted')}
                        invalid={!!form.formState.errors.privacyAccepted}
                        errorId="privacy-error"
                        error={form.formState.errors.privacyAccepted?.message}
                      />
                      <ConsentRow
                        label="(선택) 마케팅 수신 동의"
                        accessibleName="마케팅 정보 수신에 동의합니다"
                        href="/legal/privacy"
                        inputProps={form.register('marketingAccepted')}
                      />
                    </div>
                  </fieldset>
                </>
              ) : step === 'EMAIL' ? (
                <fieldset className={styles.fields} disabled={pending}>
                  <legend className="sr-only">알림을 받을 주소</legend>
                  <p className={styles.help}>
                    프로필에는 표시되지 않아요. 계정 안내와 알림을 받는 주소예요.
                  </p>
                  <div className={styles.field}>
                    <label htmlFor="notification-email">알림 이메일</label>
                    <input
                      id="notification-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@company.com"
                      {...form.register('email')}
                      aria-invalid={!!form.formState.errors.email}
                      aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                    />
                    {form.formState.errors.email && (
                      <FieldError id="email-error">{form.formState.errors.email.message}</FieldError>
                    )}
                  </div>
                </fieldset>
              ) : (
                <>
                  <div className={styles.intro}>
                    <h2>간단한 프로필을 만들어 주세요</h2>
                    <p>다른 사용자들이 개발자님을 알 수 있게 소개해 주세요!</p>
                  </div>
                  <fieldset className={styles.fields} disabled={pending}>
                    <legend className="sr-only">기본 프로필</legend>
                    <div className={styles.field}>
                      <label htmlFor="display-name">이름</label>
                      <input
                        id="display-name"
                        autoComplete="name"
                        placeholder="실명 또는 활동명을 작성해 주세요"
                        {...form.register('name')}
                        aria-invalid={!!form.formState.errors.name}
                        aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
                      />
                      {form.formState.errors.name && (
                        <FieldError id="name-error">{form.formState.errors.name.message}</FieldError>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="bio">자기 소개</label>
                      <textarea
                        id="bio"
                        rows={3}
                        placeholder="개발자님을 간단하게 소개해 주세요"
                        {...form.register('bio')}
                        aria-invalid={!!form.formState.errors.bio}
                        aria-describedby={form.formState.errors.bio ? 'bio-error' : undefined}
                      />
                      {form.formState.errors.bio && (
                        <FieldError id="bio-error">{form.formState.errors.bio.message}</FieldError>
                      )}
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldName}>기술 스택</span>
                      <button type="button" className={styles.select} onClick={() => picker.open()}>
                        <span className={selectedTech.length ? styles.value : styles.placeholder}>
                          {selectedTech.length
                            ? selectedTech.join(', ')
                            : `최대 ${techStackMax}개를 선택할 수 있습니다`}
                        </span>
                        <ChevronDown aria-hidden />
                        <span className="sr-only">기술 스택 선택</span>
                      </button>
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldName}>구직 상태</span>
                      <button
                        type="button"
                        className={styles.select}
                        aria-haspopup="dialog"
                        onClick={() => jobSheet.open()}
                      >
                        <span className={jobStatusChosen ? styles.value : styles.placeholder}>
                          {jobStatusChosen ? jobLabel : '현재 구직 상태를 알려주세요'}
                        </span>
                        <ChevronDown aria-hidden />
                        <span className="sr-only">구직 상태</span>
                      </button>
                    </div>
                  </fieldset>
                </>
              )}
            </div>
            <div
              className={`${styles.footer} ${step === 'AGREEMENTS' ? styles.agreementsFooter : ''} ${step === 'PROFILE' ? styles.profileFooter : ''}`}
            >
              {step === 'AGREEMENTS' ? (
                <button
                  type="button"
                  className={`${styles.next} ${footerReady ? styles.nextReady : ''}`}
                  onClick={continueToProfile}
                  disabled={pending}
                  aria-busy={pending}
                >
                  다음
                </button>
              ) : step === 'EMAIL' ? (
                <button
                  type="button"
                  className={`${styles.next} ${footerReady ? styles.nextReady : ''}`}
                  onClick={saveEmail}
                  disabled={pending}
                  aria-busy={pending}
                >
                  다음
                </button>
              ) : (
                <button
                  type="submit"
                  className={`${styles.next} ${footerReady ? styles.nextReady : ''}`}
                  disabled={pending || !footerReady}
                  aria-busy={pending}
                >
                  완료
                </button>
              )}
              {apiError && (
                <p className={styles.apiError} role="alert">
                  {apiError}
                </p>
              )}
            </div>
            <TechTagPicker
              overlay={picker}
              tags={techTags}
              selected={selectedTech}
              max={techStackMax}
              onToggle={toggleTechTag}
            />
            <OverlaySheet
              overlay={jobSheet}
              title="구직 상태"
              description="현재 구직 상태를 선택해 주세요."
              describeHidden
              classNames={{
                scrim: styles.jobStatusScrim,
                sheet: styles.jobStatusSheet,
                header: styles.jobStatusHeader,
                title: styles.jobStatusTitle,
                close: styles.jobStatusClose,
                body: styles.jobStatusBody,
              }}
            >
              <div className={styles.jobOptions}>
                {JOB_OPTIONS.map((option) => (
                  <label key={option.value} className={styles.option}>
                    <input
                      type="radio"
                      value={option.value}
                      {...form.register('jobStatus')}
                      onChange={() => {
                        form.setValue('jobStatus', option.value, { shouldDirty: true });
                        form.setValue('jobStatusChosen', true, { shouldValidate: true });
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.jobDone}
                onClick={() => {
                  form.setValue('jobStatusChosen', true, { shouldValidate: true });
                  jobSheet.close();
                }}
              >
                완료
              </button>
            </OverlaySheet>
          </form>
        )}
      </main>
    </div>
  );
}

function CircleMark() {
  return (
    <span className={styles.mark} aria-hidden>
      <Check />
    </span>
  );
}

function ConsentRow({
  label,
  accessibleName,
  href,
  inputProps,
  invalid = false,
  errorId,
  error,
}: {
  label: string;
  accessibleName?: string;
  href?: '/legal/terms' | '/legal/privacy';
  inputProps: UseFormRegisterReturn;
  invalid?: boolean;
  errorId?: string;
  error?: string;
}) {
  return (
    <div>
      <div className={styles.consentRow}>
        <label className={styles.consent}>
          <input
            type="checkbox"
            {...inputProps}
            aria-invalid={invalid || undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <CircleMark />
          <span>{label}</span>
          {accessibleName && <span className="sr-only">{accessibleName}</span>}
        </label>
        {href && (
          <Link className={styles.detail} href={href}>
            [ 자세히 보기 ]
          </Link>
        )}
      </div>
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return (
    <span id={id} className={styles.fieldError} role="alert">
      {children}
    </span>
  );
}
