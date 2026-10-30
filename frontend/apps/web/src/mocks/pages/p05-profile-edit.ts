import { daysAgo, get, patch, post, type MockRoute } from '../core/define';
import { ME, RECRUITER } from '../fixtures/users';

/** 05 Edit profile: `ProfileEditController` */

const form = {
  name: ME.name,
  bio: ME.bio,
  blogUrl: ME.blogUrl,
  techStack: [...ME.techStack],
  lookingForTeam: ME.lookingForTeam,
  jobStatus: ME.jobStatus,
  jobCategories: [...ME.jobCategories],
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
      return form;
    },
    { only: 'developer' },
  ),
  post('/api/v1/user/me/profile/github-sync', () => ({ ...form, syncedAt: daysAgo(0) }), {
    only: 'developer',
  }),
  patch('/api/v1/recruiter/me/profile', ({ body }) => {
    Object.assign(recruiterForm, body);
    return recruiterForm;
  }),
];
