import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { uploadImage } from '@/features/image-upload/upload-image';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { CHAT, IMAGE } from '@/lib/policy';

import { renderWithProviders as render } from '@/test/render-with-providers';

import { ChatComposer } from './ChatComposer';

vi.mock('@/features/image-upload/upload-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/image-upload/upload-image')>()),
  uploadImage: vi.fn(),
}));
const upload = vi.mocked(uploadImage);
beforeEach(() => {
  resetOverlayHistory();
  upload.mockReset();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:preview');
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
const photo = (name = 'photo.png') => new File(['photo'], name, { type: 'image/png' });

it('sends normalized non-empty text once and clears the input', async () => {
  const send = vi.fn();
  render(<ChatComposer disabled={false} onSend={send} />);
  expect(screen.queryByLabelText('채팅 사진')).not.toBeInTheDocument();
  const input = screen.getByRole('textbox', { name: '메시지' });
  await userEvent.type(input, '안녕하세요');
  await userEvent.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: '안녕하세요', images: [] });
  expect(input).toHaveValue('');
});

it('sends on Enter, breaks the line on Shift+Enter, and ignores Enter while composing Korean', async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  expect(input).toHaveAttribute('enterkeyhint', 'send');
  await user.type(input, '첫 줄');
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  await user.type(input, '둘째 줄');
  expect(input).toHaveValue('첫 줄\n둘째 줄');
  expect(send).not.toHaveBeenCalled();
  // The Enter that ends an IME composition arrives with isComposing
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  expect(send).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: '첫 줄\n둘째 줄', images: [] });
  expect(input).toHaveValue('');
  // Enter on an empty input sends nothing
  await user.keyboard('{Enter}');
  expect(send).toHaveBeenCalledTimes(1);
});

it('blocks writes while read-only', () => {
  render(<ChatComposer disabled onSend={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '사진 첨부' })).toBeDisabled();
  expect(screen.queryByLabelText('채팅 사진')).not.toBeInTheDocument();
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

it('sends the sheet photos from its 전송 button once uploaded, keeping the typed text', async () => {
  let finish!: (image: { fileId: string; url: string }) => void;
  upload.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  await user.type(screen.getByRole('textbox', { name: '메시지' }), '작성 중');
  await user.click(screen.getByRole('button', { name: '사진 첨부' }));
  await user.upload(screen.getByLabelText('채팅 사진'), photo());
  expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  const image = { fileId: 'file-1', url: '/files/uploads/1/a.png' };
  await act(async () => finish(image));
  // Nuqs' memory adapter does not emulate browser back; use the URL-entered close path.
  resetOverlayHistory();
  await user.click(await screen.findByRole('button', { name: '전송' }));
  expect(upload).toHaveBeenCalledWith(expect.any(File), expect.any(Function), 'CHAT');
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: '', images: [image] });
  expect(screen.queryByAltText('선택한 사진 1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /사진 1장 ·/ })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('작성 중');
  // The bar's send stays text-only
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenLastCalledWith({ text: '작성 중', images: [] });
});
it('keeps failed photos in the sheet and sends only after a retry succeeds', async () => {
  upload
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ fileId: 'retried', url: '/files/uploads/1/b.png' });
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  await user.click(screen.getByRole('button', { name: '사진 첨부' }));
  await user.upload(screen.getByLabelText('채팅 사진'), photo());
  await screen.findByRole('button', { name: '다시 올리기' });
  expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '다시 올리기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '전송' })).toBeEnabled());
  resetOverlayHistory();
  await user.click(screen.getByRole('button', { name: '전송' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    text: '',
    images: [{ fileId: 'retried', url: '/files/uploads/1/b.png' }],
  });
  expect(upload).toHaveBeenCalledTimes(2);
});
it('caps a send at ten photos and rejects files exceeding ten MB', async () => {
  upload.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: '사진 첨부' }));
  const oversized = photo('large.png');
  Object.defineProperty(oversized, 'size', { value: IMAGE.maxBytes + 1 });
  await user.upload(screen.getByLabelText('채팅 사진'), oversized);
  expect(upload).not.toHaveBeenCalled();
  await user.upload(
    screen.getByLabelText('채팅 사진'),
    Array.from({ length: CHAT.imagesPerSend + 1 }, (_, i) => photo(`${i}.png`)),
  );
  expect(upload).toHaveBeenCalledTimes(CHAT.imagesPerSend);
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend);
  await user.click(screen.getByRole('button', { name: '사진 1 빼기' }));
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend - 1);
});
