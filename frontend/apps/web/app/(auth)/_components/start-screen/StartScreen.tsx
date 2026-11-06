'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';

import styles from './StartScreen.module.css';
import { useStartScreen } from './hook';

export function StartScreen() {
  const { pending, error, handlers } = useStartScreen();

  return (
    <section className={styles.main} aria-labelledby="start-title">
      <div className={styles.content}>
        <p className={styles.wordmark}>LINKER</p>
        <h2 id="start-title" className={styles.title}>
          팀을 찾고, 함께 만들고,
          <br />
          작업을 보여주세요.
        </h2>
        <p className={styles.description}>
          GitHub 프로젝트를 바탕으로 개발 동료를 만나고, 함께한 결과를 나누는 공간입니다.
        </p>

        <ol className={styles.steps} aria-label="Linker에서 할 수 있는 일">
          <li>
            <span className={styles.stepNumber}>01</span>
            <span>함께할 팀과 프로젝트를 찾고</span>
          </li>
          <li>
            <span className={styles.stepNumber}>02</span>
            <span>GitHub에서 함께 작업하고</span>
          </li>
          <li>
            <span className={styles.stepNumber}>03</span>
            <span>완성한 프로젝트를 공유해요</span>
          </li>
        </ol>

        <div className={styles.actions}>
          <Button block onClick={handlers.onLogin} disabled={pending} aria-busy={pending}>
            {pending ? 'GitHub에 연결하고 있어요…' : 'GitHub로 시작'}
          </Button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button asChild block variant="outline">
            <Link href="/feed">둘러보기</Link>
          </Button>
        </div>

        <nav className={styles.legal} aria-label="약관 및 정책">
          <Link href="/legal/terms">이용약관</Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/privacy">개인정보 처리방침</Link>
        </nav>
      </div>
    </section>
  );
}
