'use client';

import { FileImageLinearIcon } from '@solar-icons/static/linear/file-image';
import { ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon/Icon';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { CHAT, IMAGE } from '@/lib/policy';

import type { ChatReferences } from '../../_lib/chat-reference-types';
import type { RoomInfo } from '../../_lib/room-api';
import { ChatReferenceTools } from '../chat-reference-tools';

import styles from '../chat-room/ChatRoom.module.css';
import { useChatComposer } from './hook';

type Props = {
  disabled: boolean;
  room?: RoomInfo;
  login?: string | null;
  onSend: (message: { text: string; images: UploadedImage[]; references?: ChatReferences }) => void;
  /** Extra button between the input and send (the team room's "AI 채팅 요약") */
  beforeSend?: ReactNode;
};

export function ChatComposer({ disabled, onSend, room, login = null, beforeSend }: Props) {
  const {
    text,
    setText,
    setCaret,
    input,
    photoInput,
    sendingPhotos,
    onPickPhotos,
    references,
    count,
    tooLong,
    canSubmit,
    submit,
    onMention,
  } = useChatComposer({ disabled, onSend, room, login });

  return (
    <form onSubmit={submit} className={styles.composer}>
      <label htmlFor="chat-message" className="sr-only">
        메시지
      </label>
      <div className={styles.composerBar}>
        {/* Picking photos sends them right away (user request 2026-11-10); no attach sheet */}
        <button
          type="button"
          disabled={disabled || sendingPhotos > 0}
          aria-label="사진 보내기"
          className={styles.attachmentToggle}
          onClick={() => photoInput.current?.click()}
        >
          <Icon svg={FileImageLinearIcon} />
        </button>
        <input
          ref={photoInput}
          type="file"
          accept={IMAGE.mimeTypes.join(',')}
          multiple
          hidden
          aria-label={`보낼 사진 선택 (한 번에 ${CHAT.imagesPerSend}장까지)`}
          onChange={onPickPhotos}
        />
        <textarea
          ref={input}
          id="chat-message"
          value={text}
          rows={1}
          disabled={disabled}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? 'chat-character-count' : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setCaret(event.target.selectionStart);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          aria-controls={references.active ? 'chat-mention-suggestions' : undefined}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && event.key === 'ArrowDown' && references.active) {
              const first = document.querySelector<HTMLButtonElement>(
                '#chat-mention-suggestions button',
              );
              if (first) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
          placeholder="채팅을 입력해 주세요."
          className={styles.input}
        />
        {beforeSend}
        <button type="submit" disabled={!canSubmit} className={styles.send}>
          <ArrowUp aria-hidden />
          <span className="sr-only">보내기</span>
        </button>
      </div>
      {sendingPhotos > 0 && (
        <p role="status" className={styles.photoStatus}>
          사진 {sendingPhotos}장 보내는 중…
        </p>
      )}
      {references.team && <ChatReferenceTools control={references} onMention={onMention} />}
      {/* Figma shows no counter; it appears only once the limit is passed */}
      {tooLong && (
        <p id="chat-character-count" role="alert" className={styles.error}>
          글자 수를 줄여 주세요. ({count.toLocaleString('ko-KR')} /{' '}
          {CHAT.messageMax.toLocaleString('ko-KR')}자)
        </p>
      )}
    </form>
  );
}
