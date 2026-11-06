import { apiFetch } from '@/lib/api/api-fetch';

export type EmailCodeResponse = { sent: boolean; resendAfterSeconds: number; validMinutes: number };
export type VerifyResponse = { signupToken: string; emailDomain: string };

export type SignupPayload = {
  signupToken: string | null;
  password: string;
  name: string;
  company: string;
  jobTitle: string;
  websiteUrl: string;
  consents: {
    ageConfirmed: boolean;
    termsAccepted: boolean;
    businessTermsAccepted: boolean;
    personalDataAccepted: boolean;
    marketingAccepted: boolean;
  };
};

export function requestSignupEmailCode(email: string) {
  return apiFetch<EmailCodeResponse>('/api/v1/public/recruiter-signup/email-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function verifySignupEmailCode(email: string, code: string) {
  return apiFetch<VerifyResponse>('/api/v1/public/recruiter-signup/email-codes/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code }),
  });
}

export function completeRecruiterSignup(payload: SignupPayload) {
  return apiFetch<{ login: string }>('/api/v1/public/recruiter-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signupToken: payload.signupToken,
      password: payload.password,
      name: payload.name.trim(),
      company: payload.company.trim(),
      jobTitle: payload.jobTitle.trim(),
      websiteUrl: payload.websiteUrl.trim() || null,
      consents: payload.consents,
    }),
  });
}
