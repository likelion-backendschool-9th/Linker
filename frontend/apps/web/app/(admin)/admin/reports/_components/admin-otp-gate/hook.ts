'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';

import { ADMIN } from '@/lib/policy';

import { verifyAdminOtp } from './api';

const OTP_IDLE_MS = ADMIN.otpIdleMinutes * 60 * 1000;

export function useAdminOtpGate() {
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => verifyAdminOtp(code),
    onSuccess: (result) => setVerified(result.verified),
  });

  useEffect(() => {
    if (!verified) return;
    let timer: ReturnType<typeof setTimeout>;
    const lockAfterIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVerified(false), OTP_IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    lockAfterIdle();
    events.forEach((event) => window.addEventListener(event, lockAfterIdle, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, lockAfterIdle));
    };
  }, [verified]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verify.isPending) verify.mutate();
  }

  function onCodeChange(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 6));
  }

  return {
    verified,
    code,
    onCodeChange,
    submit,
    isPending: verify.isPending,
    error: verify.error,
  };
}
