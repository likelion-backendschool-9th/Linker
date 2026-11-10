'use client';

import Image from 'next/image';
import Link from 'next/link';

import { SkipLink } from '@/components/layout/skip-link/SkipLink';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';

import styles from './StartScreen.module.css';
import { useStartScreen } from './hook';

export function StartScreen() {
  const { pending, error, handlers } = useStartScreen();

  return (
    <>
      <SkipLink />
      <main id="main" tabIndex={-1} className={styles.stage} aria-labelledby="page-title">
        <StatusBanners />
        <div className={styles.column}>
          <header className={styles.brand}>
            <h1 id="page-title" className={styles.wordmark}>
              <Image
                className={styles.logo}
                src="/textlogo.svg"
                alt=""
                width={185}
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
              className={styles.github}
              onClick={handlers.onLogin}
              disabled={pending}
              aria-busy={pending}
            >
              <GitHubMark className={styles.githubIcon} width={24} height={24} />
              GitHub로 시작
            </button>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <p className={styles.or}>또는</p>
            <Link className={styles.secondary} href="/feed">
              둘러보기
            </Link>
            <Link className={styles.secondary} href="/recruiter/login">
              채용 담당자이신가요?
            </Link>
          </div>

          <div className={styles.policy}>
            <nav className={styles.legal} aria-label="약관 및 정책">
              <Link href="/legal/terms">이용 약관</Link>
              <Link href="/legal/privacy">개인 정보 처리 방침</Link>
            </nav>
            <p className={styles.notice}>로그인 시 위 약관에 동의한 것으로 간주 됩니다.</p>
          </div>
        </div>
      </main>
    </>
  );
}
