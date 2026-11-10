import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { uploadImage } from '@/features/image-upload/upload-image';
import { CHAT, IMAGE } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { renderWithProviders as render } from '@/test/render-with-providers';

import { ChatComposer } from './ChatComposer';

vi.mock('@/features/image-upload/upload-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/image-upload/upload-image')>()),
  uploadImage: vi.fn(),
}));
vi.mock('@/stores/toast-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/toast-store')>()),
  toast: vi.fn(),
}));
const upload = vi.mocked(uploadImage);
const alert = vi.mocked(toast);
beforeEach(() => {
  upload.mockReset();
  alert.mockReset();
});
const photo = (name = 'photo.png') => new File(['photo'], name, { type: 'image/png' });
const picker = () => screen.getByLabelText(/보낼 사진 선택/);

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
  expect(screen.getByRole('button', { name: '사진 보내기' })).toBeDisabled();
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

it('sends picked photos as soon as they upload, keeping the typed text', async () => {
  let finish!: (image: { fileId: string; url: string }) => void;
  upload
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({ fileId: 'file-2', url: '/files/uploads/1/b.png' });
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '작성 중');
  await user.upload(picker(), [photo('a.png'), photo('b.png')]);
  // No attach sheet or send tap: both upload at once and the button waits for them
  expect(await screen.findByRole('status')).toHaveTextContent('사진 2장 보내는 중…');
  expect(screen.getByRole('button', { name: '사진 보내기' })).toBeDisabled();
  expect(send).not.toHaveBeenCalled();
  const first = { fileId: 'file-1', url: '/files/uploads/1/a.png' };
  await act(async () => finish(first));
  await waitFor(() =>
    expect(send).toHaveBeenCalledExactlyOnceWith({
      text: '',
      images: [first, { fileId: 'file-2', url: '/files/uploads/1/b.png' }],
    }),
  );
  expect(upload).toHaveBeenCalledWith(expect.any(File), expect.any(Function), 'CHAT');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('작성 중');
  expect(screen.getByRole('button', { name: '사진 보내기' })).toBeEnabled();
});

it('sends the photos that uploaded and reports the ones that failed', async () => {
  upload
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ fileId: 'ok', url: '/files/uploads/1/ok.png' });
  const send = vi.fn();
  render(<ChatComposer disabled={false} onSend={send} />);
  await userEvent.upload(picker(), [photo('fail.png'), photo('ok.png')]);
  await waitFor(() =>
    expect(send).toHaveBeenCalledExactlyOnceWith({
      text: '',
      images: [{ fileId: 'ok', url: '/files/uploads/1/ok.png' }],
    }),
  );
  expect(alert).toHaveBeenCalledWith('사진 1장을 보내지 못했어요. 다시 골라 주세요.', {
    tone: 'alert',
  });
});

it('caps a send at ten photos and skips files over ten MB', async () => {
  upload.mockReturnValue(new Promise(() => {}));
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  const oversized = photo('large.png');
  Object.defineProperty(oversized, 'size', { value: IMAGE.maxBytes + 1 });
  await userEvent.upload(picker(), oversized);
  expect(upload).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('10MB'), { tone: 'alert' });
  await userEvent.upload(
    picker(),
    Array.from({ length: CHAT.imagesPerSend + 1 }, (_, i) => photo(`${i}.png`)),
  );
  expect(upload).toHaveBeenCalledTimes(CHAT.imagesPerSend);
  expect(alert).toHaveBeenCalledWith(`사진은 한 번에 ${CHAT.imagesPerSend}장까지 보낼 수 있어요.`, {
    tone: 'alert',
  });
});
