'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { RECRUIT } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { applyToRecruit, type RecruitDetail } from '../../_lib/detail-queries';

export function useRecruitApplySheet() {
  return useOverlay('recruit-apply');
}

export function useApplyForm(recruit: RecruitDetail, overlay: OverlayControl) {
  const id = useId();
  const client = useQueryClient();
  const open = recruit.roles.filter((role) => role.remaining > 0);
  const [roleId, setRoleId] = useState<number | null>(open.length === 1 ? open[0]!.id : null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<{ field: 'role' | 'message' | null; text: string } | null>(
    null,
  );
  const count = countChars(message);

  const apply = useMutation({
    mutationFn: (body: { roleId: number; message: string }) =>
      applyToRecruit(String(recruit.id), body),
    onSuccess: async () => {
      overlay.close();
      toast('지원했어요. 결과는 알림으로 알려 드릴게요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'RATE_LIMITED') {
        setError({ field: null, text: '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.' });
      } else if (failure instanceof ApiError && failure.status < 500) {
        setError({ field: null, text: failure.message });
      } else {
        setError({ field: null, text: '지원하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      }
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (apply.isPending) return;
    if (roleId === null) {
      setError({ field: 'role', text: '지원할 역할을 골라 주세요.' });
      document.getElementById(`${id}-role-${open[0]?.id}`)?.focus();
      return;
    }
    if (count > RECRUIT.applyMessageMax) {
      setError({
        field: 'message',
        text: `하고 싶은 말은 ${RECRUIT.applyMessageMax}자까지 쓸 수 있어요.`,
      });
      document.getElementById(`${id}-message`)?.focus();
      return;
    }
    setError(null);
    apply.mutate({ roleId, message: normalizeLineBreaks(message.trim()) });
  };

  return {
    id,
    openRoles: open,
    roleId,
    setRoleId,
    message,
    setMessage,
    error,
    count,
    messageMax: RECRUIT.applyMessageMax,
    applyPending: apply.isPending,
    submit,
    close: () => overlay.close(),
  };
}
