import type { UseFormRegisterReturn } from 'react-hook-form';

import { stripEmoji } from './text';

/** Removes emoji from the field in place, keeping the caret where the user was typing */
export function dropEmoji(el: HTMLInputElement | HTMLTextAreaElement) {
  const clean = stripEmoji(el.value);
  if (clean === el.value) return;
  const caret = stripEmoji(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
  el.value = clean;
  el.setSelectionRange(caret, caret);
}

/**
 * A react-hook-form registration for text that takes no emoji (POL-P-2, POL-R-1): emoji are dropped
 * as they are typed or pasted, so no error is shown. The schema still rejects them (old drafts).
 */
export function noEmojiField<T extends string>(field: UseFormRegisterReturn<T>): UseFormRegisterReturn<T> {
  return {
    ...field,
    onChange: (event) => {
      const target: unknown = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        dropEmoji(target);
      }
      return field.onChange(event);
    },
  };
}
