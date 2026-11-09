'use client';

import Image from 'next/image';

import { SkipLink } from '@/components/layout/skip-link/SkipLink';

import type { Invite } from '../../_lib/get-invite';
import styles from './InviteAcceptArea.module.css';
import { useInviteAcceptArea } from './hook';

/**
 * Slim invite landing (Figma 187:379). Logo + join CTA + GitHub signup link only —
 * no team preview or dedicated status screens (POL-T-2).
 */
export function InviteAcceptArea({ invite }: { invite: Invite }) {
  const { pending, onJoin, onGithubSignup } = useInviteAcceptArea(invite);

  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className={styles.stage} aria-labelledby="page-title">
        <div className={styles.column}>
          <header className={styles.brand}>
            <h1 id="page-title" className={styles.wordmark}>
              <Image
                className={styles.logo}
                src="/textlogo.svg"
                alt=""
                width={195}
                height={64}
                priority
              />
              <span className="sr-only">linker</span>
            </h1>
            <p className={styles.tagline}>개발자 SNS의 새로운 패러다임</p>
          </header>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.join}
              aria-disabled={pending}
              aria-busy={pending}
              onClick={() => void onJoin()}
            >
              팀에 합류 하기
            </button>
            <button
              type="button"
              className={styles.github}
              aria-disabled={pending}
              onClick={() => void onGithubSignup()}
            >
              GitHub로 빠르게 시작하기
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
