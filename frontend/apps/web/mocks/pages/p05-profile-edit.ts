import { daysAgo, get, patch, post, type MockRoute } from '../core/define';
import { ME, RECRUITER } from '../fixtures/users';

/** 05 Edit profile: `AccountController` */

const form = {
  name: ME.name,
  bio: ME.bio,
  blogUrl: ME.blogUrl,
  techStack: ['Java', 'Next.js', 'TypeScript', 'React', 'Spring Boot'],
  lookingForTeam: ME.lookingForTeam,
  jobStatus: ME.jobStatus,
  jobCategories: ['FRONTEND'],
};

const recruiterForm = {
  name: RECRUITER.name,
  company: RECRUITER.company,
  jobTitle: RECRUITER.jobTitle,
  websiteUrl: RECRUITER.websiteUrl,
  // Verified at sign-up, can't change (04 ch. 2)
  companyEmail: RECRUITER.email,
};

export const routes: MockRoute[] = [
  get('/api/v1/user/me/profile', ({ viewer }) =>
    viewer.role === 'recruiter'
      ? { kind: 'RECRUITER', ...recruiterForm }
      : { kind: 'DEVELOPER', ...form },
  ),
  patch(
    '/api/v1/user/me/profile',
    ({ body }) => {
      Object.assign(form, body);
      Object.assign(ME, form);
      return form;
    },
    { only: 'developer' },
  ),
  post('/api/v1/user/me/profile/github-sync', () => ({ ...form, syncedAt: daysAgo(0) }), {
    only: 'developer',
  }),
  get('/api/v1/recruiter/me/profile', () => ({ kind: 'RECRUITER', ...recruiterForm })),
  patch('/api/v1/recruiter/me/profile', ({ body }) => {
    Object.assign(recruiterForm, body);
    return { kind: 'RECRUITER', ...recruiterForm };
  }),
];
