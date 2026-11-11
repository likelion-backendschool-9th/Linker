import { SettingsLinearIcon } from '@solar-icons/static/linear/settings';
import Image from 'next/image';
import Link from 'next/link';

import { NotificationBell } from '@/features/notifications/notification-bell/NotificationBell';
import { Icon } from '@/components/ui/icon';

import type { Role } from '@/lib/auth/route-access';

import { HeaderChrome } from '../header-chrome';
import { HeaderLoginButton } from '../header-login-button';
import { HeaderLogoOrb } from '../header-logo-orb';
import styles from '../header.module.css';

type TabHeaderProps = {
  role: Role;
  /** Shows the unread dot on the 알람 button (NotificationController). */
  hasUnread?: boolean;
};

/**
 * Top bar of tab screens: logo, then icon-only buttons — "설정" (guests) or "알람" + "설정"
 * (members). There is no search icon and no profile icon in the header on any role.
 */
export function TabHeader({ role, hasUnread = false }: TabHeaderProps) {
  return (
    <HeaderChrome>
      <header className={`${styles.header} ${styles.headerTab}`}>
        <div className={`${styles.inner} ${styles.innerTab}`}>
          <Link href="/feed" className={styles.logo}>
            <HeaderLogoOrb />
            <Image src="/textlogo.svg" alt="Linker" width={79} height={24} priority />
            <span className="sr-only"> 홈</span>
          </Link>
          <div className={styles.actions}>
            {role === 'guest' ? (
              <HeaderLoginButton className={styles.iconButton}>
                <Icon svg={SettingsLinearIcon} />
                <span className="sr-only">설정</span>
              </HeaderLoginButton>
            ) : (
              <>
                <NotificationBell initiallyUnread={hasUnread} className={styles.iconButton} />
                <Link href="/settings" className={styles.iconButton}>
                  <Icon svg={SettingsLinearIcon} />
                  <span className="sr-only">설정</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </HeaderChrome>
  );
}
