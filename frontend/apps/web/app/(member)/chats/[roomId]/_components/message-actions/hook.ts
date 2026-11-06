'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';

import { reportTargetId } from '@/features/report/report-target';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { CHAT } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import {
  deleteMessage,
  editMessage,
  messageActions,
  messagesKey,
  type RoomInfo,
  type RoomMessage,
} from './api';

type Props = { room: RoomInfo; messages: RoomMessage[]; login: string | null; disabled: boolean };

export function useMessageActions({ room, messages, login, disabled }: Props) {
  const menu = useOverlay('chat-message');
  const edit = useOverlay('chat-message-edit');
  const remove = useOverlay('chat-message-delete');
  const report = useOverlay('report');
  const client = useQueryClient();
  const [clock, setClock] = useState(() => Date.now());
  const isOpen = menu.isOpen || edit.isOpen || remove.isOpen;
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);
  const [error, setError] = useState<string | null>(null);
  const targetId = menu.id ?? edit.id ?? remove.id;
  const message = messages.find((item) => String(item.id) === targetId);
  function permissions(item: RoomMessage, now = clock) {
    return messageActions(item, login, room.team?.myRole ?? null, disabled, now);
  }
  const mutation = useMutation({
    throwOnError: false,
    mutationFn: async (input: { kind: 'edit' | 'delete'; message: RoomMessage; text?: string }) => {
      if (!permissions(input.message, Date.now())[input.kind])
        throw new Error('이 메시지를 변경할 수 없어요.');
      if (input.kind === 'edit') await editMessage(room.id, input.message.id, input.text!);
      else await deleteMessage(room.id, input.message.id);
    },
    onSuccess: async (_, input) => {
      setError(null);
      if (input.kind === 'edit') edit.close();
      else remove.close();
      await client.invalidateQueries({ queryKey: messagesKey(login, room.id) });
      toast(input.kind === 'edit' ? '메시지를 수정했어요.' : '메시지를 삭제했어요.');
    },
    onError: () =>
      setError('메시지를 변경하지 못했어요. 권한과 연결 상태를 확인하고 다시 시도해 주세요.'),
  });
  const allowed = message ? permissions(message) : null;

  return {
    menu,
    edit,
    remove,
    report,
    message,
    allowed,
    error,
    mutation,
    clearError: () => setError(null),
    copyText: async () => {
      if (!message?.text) return;
      try {
        await navigator.clipboard.writeText(message.text);
        toast('메시지를 복사했어요.');
        menu.close();
      } catch {
        toast('복사하지 못했어요. 브라우저 권한을 확인해 주세요.');
      }
    },
    openEdit: () => {
      if (!message) return;
      setError(null);
      edit.open(String(message.id));
    },
    openDelete: () => {
      if (!message) return;
      setError(null);
      remove.open(String(message.id));
    },
    openReport: () => {
      if (!message) return;
      report.open(
        reportTargetId(room.kind === 'TEAM' ? 'TEAM_MESSAGE' : 'DM_MESSAGE', message.id),
      );
    },
    submitEdit: (text: string) => {
      if (!message) return;
      setError(null);
      mutation.mutate({ kind: 'edit', message, text });
    },
    submitDelete: () => {
      if (!message) return;
      setError(null);
      mutation.mutate({ kind: 'delete', message });
    },
  };
}

export function useEditMessageForm({
  message,
  pending,
  onSubmit,
}: {
  message: RoomMessage;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(message.text ?? '');
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const invalid = !count || count > CHAT.messageMax;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!pending && !invalid) onSubmit(normalized);
  }

  return {
    text,
    setText,
    count,
    invalid,
    max: CHAT.messageMax,
    submit,
  };
}
