import type { Role } from '@/lib/auth/route-access';

/** Bottom tabs per role (04 ch. 2 "Access by role", blueprint §4-6). Profile lives in the top header, not here. */

export type TabKey = 'home' | 'recruits' | 'workspace' | 'chats';

export type TabItem = {
  key: TabKey;
  label: string;
  href: string;
  /** Guest tabs that open the login-prompt sheet instead of navigating */
  requiresLogin: boolean;
};

const LABELS: Record<TabKey, string> = {
  home: '홈 피드',
  recruits: '팀 찾기',
  workspace: '오피스',
  chats: '채팅방',
};

const TABS_BY_ROLE: Record<Role, readonly TabKey[]> = {
  guest: ['home', 'recruits', 'workspace', 'chats'],
  developer: ['home', 'recruits', 'workspace', 'chats'],
  operator: ['home', 'recruits', 'workspace', 'chats'],
  recruiter: ['home', 'chats'],
};

const GUEST_LOGIN_TABS: readonly TabKey[] = ['workspace', 'chats'];

function hrefFor(key: TabKey): string {
  switch (key) {
    case 'home':
      return '/feed';
    case 'recruits':
      return '/recruits';
    case 'workspace':
      return '/workspace';
    case 'chats':
      return '/chats';
  }
}

export function tabsFor(role: Role): TabItem[] {
  return TABS_BY_ROLE[role].map((key) => ({
    key,
    label: LABELS[key],
    href: hrefFor(key),
    requiresLogin: role === 'guest' && GUEST_LOGIN_TABS.includes(key),
  }));
}
