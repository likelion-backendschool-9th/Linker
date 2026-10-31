import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CHAT } from '@/lib/policy';

import { ChatComposer } from './chat-composer';

it('sends normalized non-empty text once and clears the input', async () => {
  const send = vi.fn();
  render(<ChatComposer disabled={false} onSend={send} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  await userEvent.type(input, '안녕하세요');
  await userEvent.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith('안녕하세요');
  expect(input).toHaveValue('');
});

it('blocks writes while read-only', () => {
  render(<ChatComposer disabled onSend={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
});

it('counts emoji as one character and rejects text over the policy maximum', async () => {
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  await userEvent.click(input);
  await userEvent.paste('🌈'.repeat(CHAT.messageMax));
  expect(screen.getByRole('button', { name: '보내기' })).toBeEnabled();
  await userEvent.paste('가');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
});
