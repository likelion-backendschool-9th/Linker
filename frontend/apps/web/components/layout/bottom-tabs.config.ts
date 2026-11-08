import type { Role } from '@/lib/auth/route-access';

/** Bottom tabs per role (04 ch. 2 "Access by role", blueprint §4-6). */

export type TabKey = 'home' | 'recruits' | 'workspace' | 'chats' | 'profile';

export type TabItem = {
  key: TabKey;
  label: string;
  href: string;
  /** Guest tabs that open the login-prompt sheet instead of navigating */
  requiresLogin: boolean;
  /** Profile tab only: the viewer's own avatar, rendered instead of a Solar icon */
  avatarUrl?: string;
};

const LABELS: Record<TabKey, string> = {
  home: '홈 피드',
  recruits: '팀 찾기',
  workspace: '오피스',
  chats: '채팅방',
  profile: '프로필',
};

const TABS_BY_ROLE: Record<Role, readonly TabKey[]> = {
  guest: ['home', 'recruits', 'workspace', 'chats'],
  developer: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  operator: ['home', 'recruits', 'workspace', 'chats', 'profile'],
  recruiter: ['home', 'chats'],
};

const GUEST_LOGIN_TABS: readonly TabKey[] = ['workspace', 'chats'];

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
      return login ? `/user/${login}` : '/feed';
  }
}

/** `member` is null for guests; `userId` builds the GitHub avatar URL for the profile tab. */
export function tabsFor(role: Role, member: { login: string; userId: number } | null = null): TabItem[] {
  return TABS_BY_ROLE[role].map((key) => ({
    key,
    label: LABELS[key],
    href: hrefFor(key, member?.login ?? null),
    requiresLogin: role === 'guest' && GUEST_LOGIN_TABS.includes(key),
    avatarUrl:
      key === 'profile' && member
        ? `https://avatars.githubusercontent.com/u/${member.userId}`
        : undefined,
  }));
}
