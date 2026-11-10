import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { uploadImage } from '@/features/image-upload/upload-image';
import { CHAT, IMAGE } from '@/lib/policy';

import { renderWithProviders as render } from '@/test/render-with-providers';

import { ChatComposer } from './ChatComposer';

vi.mock('@/features/image-upload/upload-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/image-upload/upload-image')>()),
  uploadImage: vi.fn(),
}));
const upload = vi.mocked(uploadImage);
beforeEach(() => {
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
  expect(screen.queryByRole('heading', { name: /사진 업로드/ })).not.toBeInTheDocument();
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

it('keeps Enter as a line break on touch keyboards', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query === '(pointer: coarse)' })),
  );
  try {
    const send = vi.fn();
    const user = userEvent.setup();
    render(<ChatComposer disabled={false} onSend={send} />);
    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '첫 줄{Enter}둘째 줄');
    expect(input).toHaveValue('첫 줄\n둘째 줄');
    expect(send).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '보내기' }));
    expect(send).toHaveBeenCalledExactlyOnceWith({ text: '첫 줄\n둘째 줄', images: [] });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('blocks writes while read-only', () => {
  render(<ChatComposer disabled onSend={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '사진 첨부' })).toBeDisabled();
  expect(screen.queryByRole('heading', { name: /사진 업로드/ })).not.toBeInTheDocument();
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

it('sends each picked photo as its own message and locks the input meanwhile', async () => {
  const finishes: ((image: { fileId: string; url: string }) => void)[] = [];
  upload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  );
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  await user.type(input, '작성 중');
  await user.upload(screen.getByLabelText('채팅 사진'), [photo('a.png'), photo('b.png')]);
  expect(screen.getByRole('heading', { name: '사진 업로드 2장' })).toBeInTheDocument();
  // Text can't ride along with the photos (user request 2026-11-10)
  expect(input).toBeDisabled();
  expect(input).toHaveValue('');
  expect(input).toHaveAttribute('placeholder', '사진 업로드시 채팅을 칠 수 없습니다');
  expect(screen.getByRole('button', { name: '사진 추가' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  const images = [
    { fileId: 'file-1', url: '/files/uploads/1/a.png' },
    { fileId: 'file-2', url: '/files/uploads/1/b.png' },
  ];
  await act(async () => finishes.forEach((finish, index) => finish(images[index]!)));
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(upload).toHaveBeenCalledWith(expect.any(File), expect.any(Function), 'CHAT');
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenNthCalledWith(1, { text: '', images: [images[0]] });
  expect(send).toHaveBeenNthCalledWith(2, { text: '', images: [images[1]] });
  expect(screen.queryByRole('heading', { name: /사진 업로드/ })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  // The typed text comes back once the photos are gone
  expect(input).toBeEnabled();
  expect(input).toHaveValue('작성 중');
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenLastCalledWith({ text: '작성 중', images: [] });
});
it('keeps a failed photo in the panel and sends only after a retry succeeds', async () => {
  upload
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ fileId: 'retried', url: '/files/uploads/1/b.png' });
  const send = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={send} />);
  await user.upload(screen.getByLabelText('채팅 사진'), photo());
  await screen.findByRole('button', { name: '다시 올리기' });
  expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '다시 올리기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '보내기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '보내기' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    text: '',
    images: [{ fileId: 'retried', url: '/files/uploads/1/b.png' }],
  });
  expect(upload).toHaveBeenCalledTimes(2);
});
it('caps the panel at five photos, rejects files over ten MB and closes from its header', async () => {
  upload.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<ChatComposer disabled={false} onSend={vi.fn()} />);
  const input = screen.getByRole('textbox', { name: '메시지' });
  await user.type(input, '작성 중');
  const oversized = photo('large.png');
  Object.defineProperty(oversized, 'size', { value: IMAGE.maxBytes + 1 });
  await user.upload(screen.getByLabelText('채팅 사진'), oversized);
  expect(upload).not.toHaveBeenCalled();
  expect(CHAT.imagesPerSend).toBe(5);
  await user.upload(
    screen.getByLabelText('채팅 사진'),
    Array.from({ length: CHAT.imagesPerSend + 1 }, (_, i) => photo(`${i}.png`)),
  );
  expect(upload).toHaveBeenCalledTimes(CHAT.imagesPerSend);
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend);
  expect(screen.getByRole('button', { name: '사진 추가' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '사진 1 빼기' }));
  expect(screen.getAllByAltText(/선택한 사진/)).toHaveLength(CHAT.imagesPerSend - 1);
  expect(screen.getByRole('button', { name: '사진 추가' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '사진 업로드 닫기' }));
  expect(screen.queryByAltText(/선택한 사진/)).not.toBeInTheDocument();
  expect(input).toHaveValue('작성 중');
  expect(screen.getByRole('button', { name: '사진 첨부' })).toBeEnabled();
});
