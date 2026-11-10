'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  uploadImage,
  validateImage,
  type UploadedImage,
} from '@/features/image-upload/upload-image';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { useChatReferences } from '../../_hooks/use-chat-references';
import type { ChatReferences } from '../../_lib/chat-reference-types';
import type { RoomInfo } from '../../_lib/room-api';

type Props = {
  disabled: boolean;
  room?: RoomInfo;
  login?: string | null;
  onSend: (message: { text: string; images: UploadedImage[]; references?: ChatReferences }) => void;
};

export function useChatComposer({ disabled, onSend, room, login = null }: Props) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  // Photos picked from the photo button upload and send at once (user request 2026-11-10)
  const [sendingPhotos, setSendingPhotos] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const references = useChatReferences(room, login, text, caret, disabled);
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const tooLong = count > CHAT.messageMax;
  const canSubmit = !disabled && !!normalized && !tooLong && !references.blocked;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSend({
      text: normalized,
      images: [],
      ...(references.team ? { references: references.payload } : {}),
    });
    references.reset();
    setText('');
  }

  /** Upload the picked photos together, then send the ones that made it as one photo message. */
  async function sendPhotos(files: File[]) {
    if (disabled || sendingPhotos > 0) return;
    const picked: File[] = [];
    for (const file of files) {
      const error = validateImage(file);
      if (error) {
        toast(error, { tone: 'alert' });
        continue;
      }
      if (picked.length >= CHAT.imagesPerSend) {
        toast(`사진은 한 번에 ${CHAT.imagesPerSend}장까지 보낼 수 있어요.`, { tone: 'alert' });
        break;
      }
      picked.push(file);
    }
    if (!picked.length) return;
    setSendingPhotos(picked.length);
    const results = await Promise.allSettled(
      picked.map((file) => uploadImage(file, () => {}, 'CHAT')),
    );
    setSendingPhotos(0);
    const images = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (images.length) onSend({ text: '', images });
    const failed = results.length - images.length;
    if (failed) toast(`사진 ${failed}장을 보내지 못했어요. 다시 골라 주세요.`, { tone: 'alert' });
  }

  function onPickPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Clear so picking the same photo again still fires a change
    event.target.value = '';
    void sendPhotos(files);
  }

  function onMention(mentionLogin: string) {
    if (!references.active) return;
    const next = `${text.slice(0, references.active.start)}@${mentionLogin} ${text.slice(references.active.end)}`;
    const position = references.active.start + mentionLogin.length + 2;
    setText(next);
    setCaret(position);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(position, position);
    });
  }

  return {
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
  };
}
