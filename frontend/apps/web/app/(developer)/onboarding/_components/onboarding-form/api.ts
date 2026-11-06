import { apiFetch } from '@/lib/api/api-fetch';

export type OnboardingAgreementsBody = {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingAccepted: boolean;
  termsVersion: string;
};

export type OnboardingProfileBody = {
  name: string;
  bio: string;
  blogUrl: string;
  techStack: string[];
  lookingForTeam: boolean;
  jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
};

export function saveOnboardingAgreements(body: OnboardingAgreementsBody) {
  return apiFetch('/api/v1/user/onboarding/agreements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function saveOnboardingEmail(email: string) {
  return apiFetch('/api/v1/user/onboarding/email', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function saveOnboardingProfile(body: OnboardingProfileBody) {
  return apiFetch('/api/v1/user/onboarding/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
