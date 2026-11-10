'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { rejectApplication } from '../../_lib/detail-queries';

/** Reject from the applicants drawer row; the overlay id is the application id */
export function useRejectDialog(recruitId: string) {
  const overlay = useOverlay('recruit-reject');
  const client = useQueryClient();
  const reject = useMutation({
    mutationFn: (applicationId: number) => rejectApplication(recruitId, applicationId),
    onSuccess: async () => {
      overlay.close();
      toast('지원을 거절했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    // e.g. NOT_PENDING: the row changed meanwhile, so refresh the drawer
    onError: () => void client.invalidateQueries({ queryKey: ['recruits'] }),
  });

  // Only the failure of the application this dialog is open for
  const error =
    !reject.isError || reject.variables !== Number(overlay.id)
      ? null
      : reject.error instanceof ApiError && reject.error.status < 500
        ? reject.error.message
        : '거절하지 못했어요. 잠시 후 다시 시도해 주세요.';

  return {
    overlay,
    pending: reject.isPending,
    error,
    confirm: () => {
      const applicationId = Number(overlay.id);
      if (!reject.isPending && Number.isInteger(applicationId) && applicationId > 0) {
        reject.mutate(applicationId);
      }
    },
  };
}
