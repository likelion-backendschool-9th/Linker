'use client';

import { FileImageLinearIcon } from '@solar-icons/static/linear/file-image';
import { ArrowUp, ImagePlus } from 'lucide-react';
import type { ReactNode } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { Icon } from '@/components/ui/icon/Icon';
import { ImageUploader } from '@/features/image-upload/image-uploader/ImageUploader';
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
    uploader,
    attachments,
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
      <div className={styles.composerBar}>
        <OverlaySheet
          overlay={attachments}
          title="사진 첨부"
          description="사진을 선택하고 업로드 상태를 확인해 주세요."
          trigger={
            <button
              type="button"
              disabled={disabled}
              aria-label="사진 첨부"
              className={styles.attachmentToggle}
            >
              <Icon svg={FileImageLinearIcon} />
            </button>
          }
        >
          <fieldset disabled={disabled} className={styles.attachments}>
            <legend className="sr-only">사진 첨부</legend>
            <ImageUploader uploader={uploader} label="채팅 사진" />
            <p className={styles.meta}>
              사진은 {CHAT.imagesPerSend}장까지, 한 장에 {IMAGE.maxBytes / (1024 * 1024)}MB까지 보낼
              수 있어요.
            </p>
            {!uploader.allDone && (
              <p role="status">
                사진을 모두 올린 뒤 보낼 수 있어요. 실패한 사진은 다시 올리거나 빼 주세요.
              </p>
            )}
          </fieldset>
          <Button variant="outline" onClick={attachments.close}>
            첨부 완료
          </Button>
        </OverlaySheet>
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
      {!!uploader.items.length && (
        <button
          type="button"
          className={styles.attachmentSummary}
          disabled={disabled}
          onClick={() => attachments.open()}
        >
          <ImagePlus aria-hidden />
          사진 {uploader.items.length}장 ·{' '}
          {uploader.items.some((item) => item.status === 'failed')
            ? '다시 올리기 필요'
            : uploader.allDone
              ? '전송 준비 완료'
              : '업로드 중'}
        </button>
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
