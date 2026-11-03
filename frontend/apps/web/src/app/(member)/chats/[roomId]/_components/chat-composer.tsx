'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/features/image-upload/image-uploader';
import { useImageUpload } from '@/features/image-upload/use-image-upload';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT, IMAGE } from '@/lib/policy';

import styles from './chat-room.module.css';

type Props = {
  disabled: boolean;
  onSend: (message: { text: string; images: UploadedImage[] }) => void;
};

export function ChatComposer({ disabled, onSend }: Props) {
  const uploader = useImageUpload(CHAT.imagesPerSend);
  const [text, setText] = useState('');
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const tooLong = count > CHAT.messageMax;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || (!normalized && !uploader.items.length) || tooLong || !uploader.allDone) return;
    onSend({ text: normalized, images: uploader.uploaded });
    uploader.reset([]);
    setText('');
  }
  return (
    <form onSubmit={submit} className={styles.composer}>
      <label htmlFor="chat-message" className={styles.label}>
        메시지
      </label>
      <textarea
        id="chat-message"
        value={text}
        rows={2}
        disabled={disabled}
        aria-invalid={tooLong}
        aria-describedby="chat-character-count"
        onChange={(event) => setText(event.target.value)}
        placeholder="메시지를 입력해 주세요"
        className={styles.input}
      />
      <fieldset disabled={disabled} className={styles.attachments}>
        <legend className="sr-only">사진 첨부</legend>
        <ImageUploader uploader={uploader} label="채팅 사진" />
        <p className={styles.meta}>
          사진은 {CHAT.imagesPerSend}장까지, 한 장에 {IMAGE.maxBytes / (1024 * 1024)}MB까지 보낼 수 있어요.
        </p>
        {!uploader.allDone && <p role="status">사진을 모두 올린 뒤 보낼 수 있어요. 실패한 사진은 다시 올리거나 빼 주세요.</p>}
      </fieldset>
      <div className={styles.composeActions}>
        <p id="chat-character-count" className={tooLong ? styles.error : styles.meta}>
          {count.toLocaleString('ko-KR')} / {CHAT.messageMax.toLocaleString('ko-KR')}자
          {tooLong && ' · 글자 수를 줄여 주세요.'}
        </p>
        <Button type="submit" disabled={disabled || (!normalized && !uploader.items.length) || tooLong || !uploader.allDone}>
          보내기
        </Button>
      </div>
    </form>
  );
}
