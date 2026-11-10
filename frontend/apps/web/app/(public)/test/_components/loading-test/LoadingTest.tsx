'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button/Button';
import { PageLoading } from '@/components/ui/page-loading';
import { withTimeout } from '@/lib/api/fetch-with-timeout';
import { useAppSignalStore } from '@/stores/app-signal-store';

import styles from './LoadingTest.module.css';

const PREVIEW_MS = 3000;

/**
 * Three ways to see the loading UI:
 * 1. the loading screen for a few seconds,
 * 2. the real flow: a request that never answers shows the loading orb, times out, and the shared
 *    query handler turns it into the timeout screen,
 * 3. the timeout screen right away.
 */
export function LoadingTest() {
  const [preview, setPreview] = useState(false);
  const [hanging, setHanging] = useState<{ id: number; timeoutMs: number } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setPreview(false), PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [preview]);

  return (
    <div className={styles.list}>
      <Button block onClick={() => setPreview(true)}>
        로딩 화면 {PREVIEW_MS / 1000}초 보기
      </Button>
      <Button block onClick={() => setHanging({ id: Date.now(), timeoutMs: 3000 })}>
        타임아웃 재현 (3초)
      </Button>
      <Button block onClick={() => setHanging({ id: Date.now(), timeoutMs: 10_000 })}>
        타임아웃 재현 (실제 10초)
      </Button>
      <Button
        block
        variant="outline"
        onClick={() => useAppSignalStore.setState({ loadTimedOutAt: Date.now() })}
      >
        타임아웃 화면 바로 보기
      </Button>
      <p className={styles.hint}>
        재현 버튼은 응답이 오지 않는 요청을 보내요. 로딩 화면이 뜬 채로 시간이 지나면 타임아웃
        화면으로 바뀌고, &quot;돌아가기&quot;를 누르면 이전 페이지로 가요.
      </p>

      {preview && <PageLoading />}
      {hanging && <HangingRequest key={hanging.id} id={hanging.id} timeoutMs={hanging.timeoutMs} />}
    </div>
  );
}

/** A query whose request never answers: loading orb until the time limit, then the shared timeout flow */
function HangingRequest({ id, timeoutMs }: { id: number; timeoutMs: number }) {
  const query = useQuery({
    queryKey: ['loading-test', id, timeoutMs],
    queryFn: ({ signal }) => withTimeout(() => new Promise<never>(() => {}), { timeoutMs, signal }),
    staleTime: Infinity,
  });
  return query.isPending ? <PageLoading /> : null;
}
