'use client';

import { usePathname } from 'next/navigation';

const TABS = [
  { path: 'issues', label: '이슈' },
  { path: 'board', label: '보드' },
  { path: 'calendar', label: '캘린더' },
  { path: 'settings', label: '설정' },
] as const;

export function useTeamNav(teamId: string) {
  const pathname = usePathname();
  const tabs = TABS.map((tab) => {
    const href = `/teams/${teamId}/${tab.path}`;
    const current = pathname === href || pathname.startsWith(`${href}/`);
    return { ...tab, href, current };
  });

  return { tabs };
}
