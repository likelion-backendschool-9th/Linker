import type { Role } from '@/lib/auth/route-access';

/** Bottom tabs per role (04 ch. 2 "Access by role", blueprint §4-6). */

export type TabKey = 'home' | 'recruits' | 'workspace' | 'chats' | 'profile';

export type TabItem = {
  key: TabKey;
  label: string;
  href: string;
  /** Guest tabs that open the login-prompt sheet instead of navigating */
  requiresLogin: boolean;
};

const LABELS: Record<TabKey, string> = {
  home: '홈',
  recruits: '팀 찾기',
  workspace: '워크스페이스',
  chats: '채팅',
  profile: '프로필',
};

const TABS_BY_ROLE: Record<Role, readonly TabKey[]> = {
  guest: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  developer: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  operator: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  // Profile = recruiter my page (`/u/[login]` `_views/recruiter-my-page-view.tsx`)
  recruiter: ['home', 'chats', 'profile'],
};

const GUEST_LOGIN_TABS: readonly TabKey[] = ['workspace', 'chats', 'profile'];

function hrefFor(key: TabKey, login: string | null): string {
  switch (key) {
    case 'home':
      return '/feed';
    case 'recruits':
      return '/recruits';
    case 'workspace':
      return '/workspace';
    case 'chats':
      return '/chats';
    case 'profile':
      return login ? `/u/${login}` : '/feed';
  }
}

export function tabsFor(role: Role, login: string | null): TabItem[] {
  return TABS_BY_ROLE[role].map((key) => ({
    key,
    label: LABELS[key],
    href: hrefFor(key, login),
    requiresLogin: role === 'guest' && GUEST_LOGIN_TABS.includes(key),
  }));
}
