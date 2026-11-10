'use client';

import { FileImageLinearIcon } from '@solar-icons/static/linear/file-image';
import { ArrowUp, Plus } from 'lucide-react';

import { Icon } from '@/components/ui/icon/Icon';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { CHAT, IMAGE } from '@/lib/policy';

import type { ChatReferences } from '../../_lib/chat-reference-types';
import type { RoomInfo } from '../../_lib/room-api';
import { ChatPhotoPanel } from '../chat-photo-panel';
import { ChatReferenceTools } from '../chat-reference-tools';

import styles from '../chat-room/ChatRoom.module.css';
import { useChatComposer } from './hook';

type Props = {
  disabled: boolean;
  room?: RoomInfo;
  login?: string | null;
  onSend: (message: { text: string; images: UploadedImage[]; references?: ChatReferences }) => void;
};

export function ChatComposer({ disabled, onSend, room, login = null }: Props) {
  const {
    uploader,
    picker,
    photoMode,
    pickPhotos,
    clearPhotos,
    text,
    setText,
    setCaret,
    input,
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
      {photoMode && <ChatPhotoPanel uploader={uploader} onClose={clearPhotos} />}
      {/* Photos go straight from the system picker into the panel above (user design 2026-11-10) */}
      <input
        ref={picker}
        type="file"
        accept={IMAGE.mimeTypes.join(',')}
        multiple
        tabIndex={-1}
        aria-label="채팅 사진"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) uploader.add(event.target.files);
          event.target.value = '';
        }}
      />
      <div className={styles.composerBar}>
        <button
          type="button"
          disabled={disabled || uploader.items.length >= uploader.max}
          className={styles.attachmentToggle}
          onClick={pickPhotos}
        >
          {photoMode ? (
            <Plus aria-hidden className={styles.addIcon} />
          ) : (
            <Icon svg={FileImageLinearIcon} />
          )}
          <span className="sr-only">{photoMode ? '사진 추가' : '사진 첨부'}</span>
        </button>
        <textarea
          ref={input}
          id="chat-message"
          // The typed text waits while photos are picked; the placeholder says why it is locked
          value={photoMode ? '' : text}
          rows={1}
          disabled={disabled || photoMode}
          aria-invalid={!photoMode && tooLong}
          aria-describedby={!photoMode && tooLong ? 'chat-character-count' : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setCaret(event.target.selectionStart);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          aria-controls={references.active ? 'chat-mention-suggestions' : undefined}
          onKeyDown={(event) => {
            // Korean IME: the Enter that ends a composition must not send (keyCode 229 in Chrome)
            const composing = event.nativeEvent.isComposing || event.keyCode === 229;
            // Touch keyboards have no Shift+Enter, so their return key keeps breaking the line
            const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
            // Enter sends, Shift+Enter breaks the line (user request 2026-11-10)
            if (!composing && !touch && event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              const suggestion = references.active
                ? document.querySelector<HTMLButtonElement>('#chat-mention-suggestions button')
                : null;
              // With mention suggestions open, Enter picks the first one instead of sending
              if (suggestion) suggestion.click();
              else event.currentTarget.form?.requestSubmit();
              return;
            }
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
          placeholder={photoMode ? '사진 업로드시 채팅을 칠 수 없습니다' : '채팅을 입력해 주세요.'}
          className={styles.input}
        />
        <button type="submit" disabled={!canSubmit} className={styles.send}>
          <ArrowUp aria-hidden />
          <span className="sr-only">보내기</span>
        </button>
      </div>
      {!photoMode && references.team && (
        <ChatReferenceTools control={references} onMention={onMention} />
      )}
      {/* Figma shows no counter; it appears only once the limit is passed */}
      {!photoMode && tooLong && (
        <p id="chat-character-count" role="alert" className={styles.error}>
          글자 수를 줄여 주세요. ({count.toLocaleString('ko-KR')} /{' '}
          {CHAT.messageMax.toLocaleString('ko-KR')}자)
        </p>
      )}
    </form>
  );
}
