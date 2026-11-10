import type { UseFormRegisterReturn } from 'react-hook-form';

import { dropEmoji, noEmojiField } from './no-emoji-field';

function input(value: string, caret: number) {
  const el = document.createElement('input');
  el.value = value;
  el.setSelectionRange(caret, caret);
  return el;
}

it('drops emoji and keeps the caret right after what was typed', () => {
  const el = input('배포 🚀완료', '배포 🚀'.length);
  dropEmoji(el);
  expect(el.value).toBe('배포 완료');
  expect(el.selectionStart).toBe('배포 '.length);
});

it('leaves text without emoji untouched', () => {
  const el = input('서울 강남', 2);
  dropEmoji(el);
  expect(el.value).toBe('서울 강남');
  expect(el.selectionStart).toBe(2);
});

it('cleans the field before react-hook-form reads it', async () => {
  const onChange = vi.fn(async () => undefined);
  const field = { name: 'title', onChange, onBlur: vi.fn(), ref: vi.fn() } as unknown as
    UseFormRegisterReturn<'title'>;
  const el = input('팀원 모집 🙌', 7);

  await noEmojiField(field).onChange({ target: el, type: 'change' });

  expect(el.value).toBe('팀원 모집 ');
  expect(onChange).toHaveBeenCalledOnce();
});
