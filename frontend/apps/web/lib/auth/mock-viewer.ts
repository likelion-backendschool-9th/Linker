import { GUEST, type Viewer } from './route-access';

/**
 * Who is logged in while mocks are on (blueprint §1-2). The role lives in a plain cookie, so the proxy,
 * server components and browser-side mock fetch can all read it. Switch with `/api/mock/login/[role]`.
 */
export const MOCK_ROLES = ['guest', 'developer', 'newcomer', 'recruiter', 'operator'] as const;
export type MockRole = (typeof MOCK_ROLES)[number];

export const MOCK_ROLE_COOKIE = 'linker_mock_role';

export const MOCK_ROLE_LABELS: Record<MockRole, string> = {
  guest: '비로그인',
  developer: '개발자',
  newcomer: '가입 직후 개발자 (온보딩 전)',
  recruiter: '채용 담당자',
  operator: '운영자',
};

export function parseMockRole(value: string | undefined | null): MockRole {
  return (MOCK_ROLES as readonly string[]).includes(value ?? '') ? (value as MockRole) : 'guest';
}

export function viewerFromMockRole(role: MockRole): Viewer {
  switch (role) {
    case 'guest':
      return GUEST;
    case 'developer':
      return { role: 'developer', onboarded: true, status: 'ACTIVE' };
    case 'newcomer':
      return { role: 'developer', onboarded: false, status: 'ACTIVE' };
    case 'recruiter':
      return { role: 'recruiter', onboarded: true, status: 'ACTIVE' };
    case 'operator':
      return { role: 'operator', onboarded: true, status: 'ACTIVE' };
  }
}
