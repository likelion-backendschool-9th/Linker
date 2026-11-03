'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { reportTargetId } from '@/features/report/report-target';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { CHAT } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { messageActions } from '../_lib/message-actions';
import { deleteMessage, editMessage, messagesKey, type RoomInfo, type RoomMessage } from '../_lib/room-api';
import styles from './chat-room.module.css';

type Props = { room: RoomInfo; messages: RoomMessage[]; login: string | null; disabled: boolean };

export function MessageActions({ room, messages, login, disabled }: Props) {
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
      if (!permissions(input.message, Date.now())[input.kind]) throw new Error('이 메시지를 변경할 수 없어요.');
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
    onError: () => setError('메시지를 변경하지 못했어요. 권한과 연결 상태를 확인하고 다시 시도해 주세요.'),
  });
  // A URL may outlive a message or point to one outside the loaded history.
  const unavailable = <p role="status">변경할 수 없는 메시지예요.</p>;
  const allowed = message ? permissions(message) : null;
  return (
    <>
      <OverlaySheet overlay={menu} title="메시지 메뉴" description="메시지에 사용할 기능을 선택해 주세요.">
        {message && allowed && Object.values(allowed).some(Boolean) ? (
          <div className={styles.composer}>
            {allowed.copy && <Button variant="soft" onClick={async () => {
              try {
                await navigator.clipboard.writeText(message.text!);
                toast('메시지를 복사했어요.');
                menu.close();
              } catch { toast('복사하지 못했어요. 브라우저 권한을 확인해 주세요.'); }
            }}>복사</Button>}
            {allowed.edit && <Button variant="outline" onClick={() => { setError(null); edit.open(String(message.id)); }}>수정</Button>}
            {allowed.delete && <Button variant="danger" onClick={() => { setError(null); remove.open(String(message.id)); }}>삭제</Button>}
            {allowed.report && <Button variant="outline" onClick={() => report.open(reportTargetId(room.kind === 'TEAM' ? 'TEAM_MESSAGE' : 'DM_MESSAGE', message.id))}>신고</Button>}
          </div>
        ) : unavailable}
      </OverlaySheet>
      <OverlaySheet overlay={edit} title="메시지 수정" description="본인 메시지는 작성 후 24시간 이내에 수정할 수 있어요.">
        {message && allowed?.edit ? <EditMessageForm key={`${message.id}:${message.editedAt}`} message={message} pending={mutation.isPending} onSubmit={(text) => { setError(null); mutation.mutate({ kind: 'edit', message, text }); }} /> : unavailable}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </OverlaySheet>
      <OverlaySheet overlay={remove} title="메시지를 삭제할까요?" description="삭제하면 메시지 내용을 되돌릴 수 없어요.">
        {message && allowed?.delete ? <Button variant="danger" disabled={mutation.isPending} onClick={() => { setError(null); mutation.mutate({ kind: 'delete', message }); }}>삭제</Button> : unavailable}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </OverlaySheet>
    </>
  );
}

function EditMessageForm({ message, pending, onSubmit }: {
  message: RoomMessage; pending: boolean; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(message.text ?? '');
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const invalid = !count || count > CHAT.messageMax;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!pending && !invalid) onSubmit(normalized);
  }
  return (
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor="edit-chat-message">메시지</label>
      <textarea id="edit-chat-message" className={styles.input} rows={3} value={text} disabled={pending} aria-invalid={invalid} aria-describedby="edit-chat-count" onChange={(event) => setText(event.target.value)} />
      <p id="edit-chat-count" className={invalid ? styles.error : styles.meta}>{count} / {CHAT.messageMax}자</p>
      <Button type="submit" disabled={pending || invalid}>저장</Button>
    </form>
  );
}
