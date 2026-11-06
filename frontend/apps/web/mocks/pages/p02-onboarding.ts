import { get, post, put, type MockRoute } from '../core/define';
import { ME } from '../fixtures/users';

/** 02 Onboarding: `AccountController` (terms → profile) */
export const routes: MockRoute[] = [
  get('/api/v1/user/onboarding', ({ viewer }) => ({
    done: viewer.onboarded,
    // GitHub-loaded defaults the form starts from
    step: 'AGREEMENTS' as 'AGREEMENTS' | 'PROFILE' | 'EMAIL',
    defaults: {
      name: ME.name,
      bio: ME.bio,
      blogUrl: ME.blogUrl,
      techStack: [] as string[],
      lookingForTeam: false,
      jobStatus: 'OFF',
    },
    // `[Included]`: only when GitHub gave no email
    emailRequired: false,
    termsVersion: '2026-10-01',
  })),
  post('/api/v1/user/onboarding/agreements', () => undefined),
  put('/api/v1/user/onboarding/profile', ({ setMockRole }) => {
    // Finishing onboarding re-issues the cookie with onb = true (WBS 00 A tasks)
    setMockRole('developer');
    return undefined;
  }),
  put('/api/v1/user/onboarding/email', () => undefined),
];
