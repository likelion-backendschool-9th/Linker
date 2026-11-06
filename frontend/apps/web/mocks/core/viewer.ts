import type { MockRole } from '@/lib/auth/mock-viewer';
import type { Role } from '@/lib/auth/route-access';

import { ME, RECRUITER, type MockUser } from '../fixtures/users';

/** The caller as the mock API sees them */
export type MockViewer = {
  mockRole: MockRole;
  role: Role;
  /** null for guests */
  me: MockUser | null;
  onboarded: boolean;
};

export function buildViewer(mockRole: MockRole): MockViewer {
  switch (mockRole) {
    case 'guest':
      return { mockRole, role: 'guest', me: null, onboarded: true };
    case 'recruiter':
      return { mockRole, role: 'recruiter', me: RECRUITER, onboarded: true };
    case 'operator':
      return { mockRole, role: 'operator', me: { ...ME, isAdmin: true }, onboarded: true };
    case 'newcomer':
      return { mockRole, role: 'developer', me: ME, onboarded: false };
    case 'developer':
      return { mockRole, role: 'developer', me: ME, onboarded: true };
  }
}
