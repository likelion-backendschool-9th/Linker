import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { uploadImage } from '@/features/image-upload/upload-image';
import { CHAT, IMAGE } from '@/lib/policy';

import { renderWithProviders as render } from '@/test/render-with-providers';

import { ChatComposer } from './chat-composer';

vi.mock('@/features/image-upload/upload-image', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/image-upload/upload-image')>(),
  uploadImage: vi.fn(),
}));
const upload = vi.mocked(uploadImage);
beforeEach(() => {
  upload.mockReset();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => vi.unstubAllGlobals());
const photo = (name = 'photo.png') => new File(['photo'], name, { type: 'image/png' });

it('sends normalized non-empty text once and clears the input', async () => {
  const send = vi.fn();
  render(<ChatComposer disabled={false} onSend={send} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  await userEvent.type(input, '안녕하세요');
  await userEvent.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: '안녕하세요', images: [] });
  expect(input).toHaveValue('');
});

it('blocks writes while read-only', () => {
  render(<ChatComposer disabled onSend={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  expect(screen.getByLabelText('채팅 사진')).toBeDisabled();
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

it('waits for upload completion, then sends photos without text and clears the picker', async () => {
  let finish!: (image: { fileId: string; url: string }) => void;
  upload.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  await user.upload(screen.getByLabelText('채팅 사진'), photo());
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  const image = { fileId: 'file-1', url: '/mock/cover-1.svg' };
  await act(async () => finish(image));
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: '', images: [image] });
  expect(screen.queryByAltText('선택한 사진 1')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
it('keeps text and failed photos, and allows upload retry before sending', async () => {
  upload.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ fileId: 'retried', url: '/mock/cover-1.svg' });
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '사진 설명');
  await user.upload(screen.getByLabelText('채팅 사진'), photo());
  await screen.findByRole('button', { name: '다시 올리기' });
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('사진 설명');
  await user.click(screen.getByRole('button', { name: '다시 올리기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '보내기' })).toBeEnabled());
  expect(upload).toHaveBeenCalledTimes(2);
});
it('caps a send at ten photos and rejects files exceeding ten MB', async () => {
  upload.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  const oversized = photo('large.png');
  Object.defineProperty(oversized, 'size', { value: IMAGE.maxBytes + 1 });
  await user.upload(screen.getByLabelText('채팅 사진'), oversized);
  expect(upload).not.toHaveBeenCalled();
  await user.upload(screen.getByLabelText('채팅 사진'), Array.from({ length: CHAT.imagesPerSend + 1 }, (_, i) => photo(`${i}.png`)));
  expect(upload).toHaveBeenCalledTimes(CHAT.imagesPerSend);
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend);
  await user.click(screen.getByRole('button', { name: '사진 1 빼기' }));
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend - 1);
});
