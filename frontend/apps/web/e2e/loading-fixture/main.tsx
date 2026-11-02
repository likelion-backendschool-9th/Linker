import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '../../src/styles/globals.css';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '../../src/components/ui/button';
import { LoadingIndicator } from '../../src/components/ui/loading-indicator';
import { Skeleton } from '../../src/components/ui/skeleton';
import styles from './styles.module.css';

function LoadingFixture() {
  const [pending, setPending] = useState(false);
  const [calls, setCalls] = useState(0);
  return (
    <main className={styles.fixture}>
      <h1>공통 로딩 회귀 검증</h1>
      <div data-fixture-inline>
        <LoadingIndicator label="목록을 불러오고 있어요." />
      </div>
      <button type="button" data-toggle onClick={() => setPending((value) => !value)}>
        대기 상태 전환
      </button>
      <p data-action-count>실행 {calls}회</p>
      <div className={styles.buttons}>
        {(['primary', 'outline', 'soft', 'danger'] as const).map((variant) => (
          <div key={variant} data-fixture-button={variant}>
            <Button
              variant={variant}
              pending={pending}
              pendingLabel="저장 중…"
              onClick={() => setCalls((n) => n + 1)}
            >
              저장
            </Button>
          </div>
        ))}
        <div data-fixture-button="wide">
          <Button block pending={pending} pendingLabel="저장 중…">
            긴 한국어 이름으로 작업물 저장하기
          </Button>
        </div>
        <Button asChild>
          <a href="#placeholders">자리 표시로 이동</a>
        </Button>
      </div>
      <section id="placeholders" aria-label="자리 보존 검증">
        <h2>자리 보존 검증</h2>
        <div data-placeholder="visible">
          {pending ? (
            <LoadingIndicator label="피드를 불러오고 있어요." variant="block">
              <Skeleton count={2} />
            </LoadingIndicator>
          ) : (
            <div>
              <p role="status">피드를 불러오고 있어요.</p>
              <Skeleton count={2} />
            </div>
          )}
        </div>
        <div data-placeholder="hidden">
          {pending ? (
            <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
              <Skeleton count={2} />
            </LoadingIndicator>
          ) : (
            <Skeleton count={2} />
          )}
        </div>
        <div data-placeholder="lines">
          {pending ? (
            <LoadingIndicator label="레포를 불러오고 있어요." variant="inline">
              <Skeleton variant="line" count={2} />
            </LoadingIndicator>
          ) : (
            <div>
              <p role="status">레포를 불러오고 있어요.</p>
              <Skeleton variant="line" count={2} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<LoadingFixture />);
