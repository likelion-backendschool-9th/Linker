'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@/lib/api/api-error';
import { RECRUITER } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import {
  fetchPasswordResetTokenStatus,
  requestPasswordReset,
  resetPassword,
} from './api';

const emailSchema = z.object({
  email: z.string().trim().email('회사 이메일 형식을 확인해 주세요.'),
});
export type EmailValues = z.infer<typeof emailSchema>;

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(RECRUITER.password.min, `비밀번호는 ${RECRUITER.password.min}자 이상 입력해 주세요.`)
      .max(RECRUITER.password.max, `비밀번호는 ${RECRUITER.password.max}자 이내로 입력해 주세요.`)
      .refine(
        (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
        '비밀번호에 영문과 숫자를 모두 포함해 주세요.',
      ),
    confirmPassword: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: '비밀번호가 일치하지 않아요.',
  });
export type PasswordValues = z.infer<typeof passwordSchema>;

export function useRecruiterResetFlow(token: string) {
  const router = useRouter();
  const [requestSent, setRequestSent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues: { email: '' },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues: { password: '', confirmPassword: '' },
  });

  const tokenStatus = useQuery({
    queryKey: ['recruiter-password-reset-token', token],
    queryFn: () => fetchPasswordResetTokenStatus(token),
    enabled: Boolean(token),
    retry: false,
  });

  const request = useMutation({
    mutationFn: (values: EmailValues) => requestPasswordReset(values.email),
    onSuccess: () => {
      setRequestSent(true);
      setApiError(null);
    },
    onError: (error) =>
      setApiError(
        error instanceof ApiError
          ? error.message
          : '재설정 링크를 요청하지 못했어요. 다시 시도해 주세요.',
      ),
  });

  const reset = useMutation({
    mutationFn: (values: PasswordValues) => resetPassword(token, values.password),
    onSuccess: () => {
      toast('비밀번호를 재설정했어요. 다시 로그인해 주세요.');
      router.replace('/recruiter/login');
    },
    onError: (error) =>
      setApiError(
        error instanceof ApiError
          ? error.message
          : '비밀번호를 재설정하지 못했어요. 다시 시도해 주세요.',
      ),
  });

  function onRequestSubmit(values: EmailValues) {
    setApiError(null);
    request.mutate(values);
  }

  function onResetSubmit(values: PasswordValues) {
    setApiError(null);
    reset.mutate(values);
  }

  return {
    emailForm,
    passwordForm,
    tokenStatus,
    requestSent,
    apiError,
    requestPending: request.isPending,
    resetPending: reset.isPending,
    handlers: { onRequestSubmit, onResetSubmit },
  };
}
