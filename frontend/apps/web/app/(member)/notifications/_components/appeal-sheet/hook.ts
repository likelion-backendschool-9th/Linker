'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  notificationKeys,
  submitAppeal,
  updateNotifications,
  type NotificationItem,
  type NotificationPage,
} from './api';

export function useAppealSheet(notification: NotificationItem | null) {
  const overlay = useOverlay('appeal');
  const { login } = useViewer();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const [invalid, setInvalid] = useState(false);
  function recordSubmitted(sanctionId: number) {
    client.setQueriesData<InfiniteData<NotificationPage>>(
      { queryKey: notificationKeys.lists(login) },
      (data) =>
        updateNotifications(data, (item) =>
          item.appeal?.sanctionId === sanctionId
            ? { ...item, appeal: { ...item.appeal, submitted: true } }
            : item,
        ),
    );
  }
  const appeal = useMutation({
    mutationFn: ({ sanctionId, body }: { sanctionId: number; body: string }) =>
      submitAppeal(sanctionId, body),
    onSuccess: async (_, { sanctionId }) => {
      recordSubmitted(sanctionId);
      toast('이의 제기를 접수했어요.');
      await client.invalidateQueries({ queryKey: notificationKeys.lists(login) });
    },
    onError: (error, { sanctionId }) => {
      if (error instanceof ApiError && error.code === 'ALREADY_APPEALED') {
        recordSubmitted(sanctionId);
        toast('이미 이의 제기를 접수했어요.');
      }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    if (!notification?.appeal || notification.appeal.submitted || appeal.isPending) return;
    setInvalid(false);
    appeal.mutate({ sanctionId: notification.appeal.sanctionId, body: body.trim() });
  }
  const duplicate = appeal.error instanceof ApiError && appeal.error.code === 'ALREADY_APPEALED';
  const submitted = notification?.appeal?.submitted || duplicate || appeal.isSuccess;

  return {
    overlay,
    body,
    setBody,
    input,
    invalid,
    setInvalid,
    appeal,
    submit,
    duplicate,
    submitted,
  };
}
