'use client';

import { useState, type FormEvent } from 'react';

import type { OverlayKey } from '@/lib/navigation/overlay-keys';
import { useOverlay } from '@/lib/navigation/use-overlay';

export type CreatePickOption = { value: string; label: string };

export type CreatePickSheetProps = {
  overlayKey: Extract<OverlayKey, 'issue-create-repo' | 'issue-create-template'>;
  title: string;
  value: string | null;
  options: CreatePickOption[];
  empty: string;
  onChange: (value: string) => void;
};

export function useCreatePickSheet({
  overlayKey,
  title,
  value,
  options,
  empty,
  onChange,
}: CreatePickSheetProps) {
  const overlay = useOverlay(overlayKey);

  return {
    overlay,
    title,
    value,
    options,
    empty,
    onChange,
  };
}

/** Draft lives here so remounting with `key={value}` resets to the field value. */
export function useCreatePickForm(
  value: string | null,
  onChange: (value: string) => void,
  closeAnd: (action: () => unknown) => Promise<void>,
) {
  const [draft, setDraft] = useState<string | null>(value);
  const [pending, setPending] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || pending) return;
    setPending(true);
    const selected = draft;
    // Apply after overlay popstate — otherwise history.back() undoes repo/template in the URL
    await closeAnd(() => onChange(selected));
    setPending(false);
  }

  return { draft, setDraft, confirm, pending };
}
