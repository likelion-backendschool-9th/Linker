'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';

import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import styles from '../chat-room/ChatRoom.module.css';

import { useEditMessageForm, useMessageActions } from './hook';

type Props = { room: RoomInfo; messages: RoomMessage[]; login: string | null; disabled: boolean };

export function MessageActions({ room, messages, login, disabled }: Props) {
  const {
    menu,
    edit,
    remove,
    message,
    allowed,
    error,
    mutation,
    copyText,
    openEdit,
    openDelete,
    openReport,
    submitEdit,
    submitDelete,
  } = useMessageActions({ room, messages, login, disabled });

  // A URL may outlive a message or point to one outside the loaded history.
  const unavailable = <p role="status">변경할 수 없는 메시지예요.</p>;

  return (
    <>
      <OverlaySheet overlay={menu} title="메시지 메뉴" description="메시지에 사용할 기능을 선택해 주세요.">
        {message && allowed && Object.values(allowed).some(Boolean) ? (
          <div className={styles.composer}>
            {allowed.copy && (
              <Button variant="soft" onClick={() => void copyText()}>
                복사
              </Button>
            )}
            {allowed.edit && (
              <Button variant="outline" onClick={openEdit}>
                수정
              </Button>
            )}
            {allowed.delete && (
              <Button variant="danger" onClick={openDelete}>
                삭제
              </Button>
            )}
            {allowed.report && (
              <Button variant="outline" onClick={openReport}>
                신고
              </Button>
            )}
          </div>
        ) : (
          unavailable
        )}
      </OverlaySheet>
      <OverlaySheet
        overlay={edit}
        title="메시지 수정"
        description="본인 메시지는 작성 후 24시간 이내에 수정할 수 있어요."
      >
        {message && allowed?.edit ? (
          <EditMessageForm
            key={`${message.id}:${message.editedAt}`}
            message={message}
            pending={mutation.isPending}
            onSubmit={submitEdit}
          />
        ) : (
          unavailable
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </OverlaySheet>
      <OverlaySheet
        overlay={remove}
        title="메시지를 삭제할까요?"
        description="삭제하면 메시지 내용을 되돌릴 수 없어요."
      >
        {message && allowed?.delete ? (
          <Button variant="danger" disabled={mutation.isPending} onClick={submitDelete}>
            삭제
          </Button>
        ) : (
          unavailable
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </OverlaySheet>
    </>
  );
}

function EditMessageForm({
  message,
  pending,
  onSubmit,
}: {
  message: RoomMessage;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const { text, setText, count, invalid, max, submit } = useEditMessageForm({
    message,
    pending,
    onSubmit,
  });

  return (
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor="edit-chat-message">메시지</label>
      <textarea
        id="edit-chat-message"
        className={styles.input}
        rows={3}
        value={text}
        disabled={pending}
        aria-invalid={invalid}
        aria-describedby="edit-chat-count"
        onChange={(event) => setText(event.target.value)}
      />
      <p id="edit-chat-count" className={invalid ? styles.error : styles.meta}>
        {count} / {max}자
      </p>
      <Button type="submit" disabled={pending || invalid}>
        저장
      </Button>
    </form>
  );
}
