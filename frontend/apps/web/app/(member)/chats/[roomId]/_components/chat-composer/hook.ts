'use client';

import { useRef, useState, type FormEvent } from 'react';

import { useImageUpload } from '@/features/image-upload/use-image-upload';
import type { UploadedImage } from '@/features/image-upload/upload-image';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
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
  const attachments = useOverlay('chat-attachments');
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const references = useChatReferences(room, login, text, caret, disabled);
  const normalized = normalizeLineBreaks(text).trim();
  const count = countChars(normalized);
  const tooLong = count > CHAT.messageMax;
  // Photos leave from the attach sheet's "전송" (user request 2026-11-10); the bar sends text only.
  const canSubmit = !disabled && !!normalized && !tooLong && !references.blocked;
  const canSendPhotos = !disabled && uploader.items.length > 0 && uploader.allDone;

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

  /** Send the sheet's uploaded photos as one photo message; the typed text stays in the input. */
  function sendPhotos() {
    if (!canSendPhotos) return;
    onSend({ text: '', images: uploader.uploaded });
    uploader.reset([]);
    attachments.close();
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
    canSendPhotos,
    sendPhotos,
    onMention,
  };
}
