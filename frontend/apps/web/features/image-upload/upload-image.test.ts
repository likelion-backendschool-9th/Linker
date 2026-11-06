import { apiFetch } from '@/lib/api/api-fetch';

import { uploadImage } from './upload-image';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

const file = new File(['x'], 'a.png', { type: 'image/png' });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({ fileId: '9', uploadUrl: 'http://upload' })
    .mockResolvedValueOnce({ fileId: '9', url: 'local://9' });
});
afterEach(() => vi.unstubAllEnvs());

it('omits purpose when the caller does not set one', async () => {
  await uploadImage(file, () => {});
  expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/v1/user/uploads', expect.objectContaining({
    body: JSON.stringify({ type: 'IMAGE', contentType: 'image/png', size: file.size }),
  }));
});

it('sends CHAT only when the caller asks for chat', async () => {
  await uploadImage(file, () => {}, 'CHAT');
  const init = vi.mocked(apiFetch).mock.calls[0]?.[1] as { body?: string };
  expect(JSON.parse(init.body ?? '{}')).toMatchObject({
    type: 'IMAGE',
    purpose: 'CHAT',
    contentType: 'image/png',
  });
});
