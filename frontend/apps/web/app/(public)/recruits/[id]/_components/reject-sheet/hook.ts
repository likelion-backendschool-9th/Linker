'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { rejectApplication } from '../../_lib/detail-queries';

export function useRejectSheet() {
  return useOverlay('recruit-reject');
}

type UseRejectFormArgs = {
  recruitId: string;
  applicationId: number;
  overlay: OverlayControl;
};

export function useRejectForm({ recruitId, applicationId, overlay }: UseRejectFormArgs) {
  const id = useId();
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => rejectApplication(recruitId, applicationId, reason),
    onSuccess: async () => {
      overlay.close();
      toast('지원을 거절했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reject.isPending) reject.mutate();
  };

  return {
    id,
    reason,
    setReason,
    rejectPending: reject.isPending,
    rejectError: reject.isError,
    submit,
    close: () => overlay.close(),
  };
}
