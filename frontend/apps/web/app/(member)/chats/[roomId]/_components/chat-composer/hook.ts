'use client';

import { useRef, useState, type FormEvent } from 'react';

import { useImageUpload } from '@/features/image-upload/use-image-upload';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { CHAT } from '@/lib/policy';

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
  const uploader = useImageUpload(CHAT.imagesPerSend, { purpose: 'CHAT' });
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  // With photos picked the input is locked so text never rides along (user request 2026-11-10)
  const photoMode = uploader.items.length > 0;
  const references = useChatReferences(room, login, text, caret, disabled || photoMode);
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const tooLong = count > CHAT.messageMax;
  const canSendPhotos = !disabled && photoMode && uploader.allDone;
  const canSendText = !disabled && !!normalized && !tooLong && !references.blocked;
  const canSubmit = photoMode ? canSendPhotos : canSendText;

  /** Opens the system photo picker; picked photos start uploading into the panel right away */
  function pickPhotos() {
    if (disabled || uploader.items.length >= uploader.max) return;
    picker.current?.click();
  }

  /** Each photo leaves as its own message, in the panel's order (user request 2026-11-10) */
  function sendPhotos() {
    if (!canSendPhotos) return;
    uploader.uploaded.forEach((image) => onSend({ text: '', images: [image] }));
    uploader.reset([]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (photoMode) {
      sendPhotos();
      return;
    }
    if (!canSendText) return;
    onSend({
      text: normalized,
      images: [],
      ...(references.team ? { references: references.payload } : {}),
    });
    references.reset();
    setText('');
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
    uploader,
    picker,
    photoMode,
    pickPhotos,
    clearPhotos: () => uploader.reset([]),
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
  };
}
