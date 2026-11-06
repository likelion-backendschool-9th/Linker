'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { saveNativeSession } from '@/features/auth/sync-native-session';
import { useAccountSessionRefresh } from '@/features/auth/use-account-session-refresh';
import { ApiError } from '@/lib/api/api-error';
import { safeReturnTo } from '@/lib/auth/return-to';

import { loginRecruiter, type LoginValues } from './api';

const schema = z.object({
  email: z.string().trim().email('회사 이메일 형식을 확인해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

export function useRecruiterLoginForm(returnTo: string) {
  const router = useRouter();
  const refreshSession = useAccountSessionRefresh();
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: (values: LoginValues) => loginRecruiter(values, returnTo),
    onSuccess: async (result) => {
      setApiError(null);
      try {
        await saveNativeSession();
      } catch {
        // Web login still succeeds if the native session sync fails.
      }
      refreshSession();
      router.replace(safeReturnTo(result.returnTo) as Route);
    },
    onError: (error) =>
      setApiError(
        error instanceof ApiError
          ? error.message
          : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
      ),
  });

  function onSubmit(values: LoginValues) {
    setApiError(null);
    login.mutate(values);
  }

  return {
    form,
    apiError,
    isPending: login.isPending,
    handlers: { onSubmit },
  };
}
