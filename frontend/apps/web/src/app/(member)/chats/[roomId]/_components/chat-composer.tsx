'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT } from '@/lib/policy';

import styles from './chat-room.module.css';

type Props = { disabled: boolean; onSend: (text: string) => void };

export function ChatComposer({ disabled, onSend }: Props) {
  const [text, setText] = useState('');
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const tooLong = count > CHAT.messageMax;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !normalized || tooLong) return;
    onSend(normalized);
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
      <div className={styles.composeActions}>
        <p id="chat-character-count" className={tooLong ? styles.error : styles.meta}>
          {count.toLocaleString('ko-KR')} / {CHAT.messageMax.toLocaleString('ko-KR')}자
          {tooLong && ' · 글자 수를 줄여 주세요.'}
        </p>
        <Button type="submit" disabled={disabled || !normalized || tooLong}>
          보내기
        </Button>
      </div>
    </form>
  );
}
