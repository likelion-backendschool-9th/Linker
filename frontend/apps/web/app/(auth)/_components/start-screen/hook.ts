'use client';

import { useState } from 'react';

import { startGithubLogin } from './api';

export function useStartScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setPending(true);
    setError(null);
    try {
      await startGithubLogin('/feed');
    } catch {
      setError('GitHub 로그인에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return { pending, error, handlers: { onLogin } };
}
