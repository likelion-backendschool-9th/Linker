import type { Route } from 'next';
import type { ReactNode } from 'react';

import { hasUnreadNotifications } from '@/features/notifications/get-unread';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';
import { getSession, viewerFromSession } from '@/lib/auth/session';

import { BottomTabBar } from '../bottom-tab-bar';
import { tabsFor } from '../bottom-tabs.config';
import styles from './PageFrame.module.css';
import { SkipLink } from '../skip-link';
import { StackHeader } from '../stack-header';
import { TabHeader } from '../tab-header';

type PageFrameProps = {
  /** The page's single h1 */
  title: string;
  /** tab: logo header, h1 in main · stack: back + title header, the title is the h1 */
  variant?: 'tab' | 'stack';
  /** tab screens whose h1 would repeat the logo/tabs (e.g. 홈) keep it for screen readers only */
  hideTitle?: boolean;
  /** stack: optional h1 content in place of the plain title (e.g. the team-switch button of 11–15) */
  titleContent?: ReactNode;
  /** stack: where back goes when there's no in-app history */
  backHref?: Route;
  /** stack: header actions (share, more) */
  actions?: ReactNode;
  /** Defaults to on for tab screens, off for stack screens (chat room, editors) */
  bottomTabs?: boolean;
  children: ReactNode;
};

/**
 * Every page's landmarks in one place (blueprint §6-1): skip link → header → `main#main` with one h1
 * → `nav "주 메뉴"`. Use it in each `page.tsx` (and `loading.tsx` with the same props).
 */
export async function PageFrame({
  title,
  variant = 'tab',
  hideTitle = false,
  titleContent,
  backHref,
  actions,
  bottomTabs,
  children,
}: PageFrameProps) {
  const session = await getSession();
  const { role } = viewerFromSession(session);
  const showTabs = bottomTabs ?? variant === 'tab';
  const hasUnread = session ? await hasUnreadNotifications() : false;

  return (
    <>
      <SkipLink />
      {variant === 'tab' ? (
        <TabHeader role={role} hasUnread={hasUnread} />
      ) : (
        <StackHeader
          title={title}
          titleContent={titleContent}
          backHref={backHref}
          actions={actions}
        />
      )}
      <main
        id="main"
        tabIndex={-1}
        aria-labelledby="page-title"
        className={`${styles.main} ${showTabs ? styles.withTabs : ''}`}
      >
        <StatusBanners />
        {variant === 'tab' && (
          <h1 id="page-title" className={hideTitle ? 'sr-only' : styles.title}>
            {title}
          </h1>
        )}
        {children}
      </main>
      {showTabs && (
        <BottomTabBar
          tabs={tabsFor(role, session ? { login: session.login, userId: session.userId } : null)}
        />
      )}
    </>
  );
}
