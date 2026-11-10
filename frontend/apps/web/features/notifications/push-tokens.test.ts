import { apiFetch } from '@/lib/api/api-fetch';

import {
  getRegisteredPushToken,
  registerPushToken,
  resetRegisteredPushToken,
  unregisterPushToken,
} from './push-tokens';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  resetRegisteredPushToken();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(undefined);
});

it('registers Android tokens and remembers them for logout', async () => {
  await registerPushToken('expo-1', 'android');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/push-tokens',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'expo-1', platform: 'android' }),
    }),
  );
  expect(getRegisteredPushToken()).toBe('expo-1');
});

it('skips iOS registration in the MVP', async () => {
  await registerPushToken('expo-ios', 'ios');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(getRegisteredPushToken()).toBeNull();
});

it('deletes the remembered token on unregister', async () => {
  await registerPushToken('expo-1', 'android');
  await unregisterPushToken();
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/v1/user/push-tokens/${encodeURIComponent('expo-1')}`,
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(getRegisteredPushToken()).toBeNull();
});

it('clears memory even when delete fails', async () => {
  await registerPushToken('expo-1', 'android');
  fetchMock.mockRejectedValueOnce(new Error('gone'));
  await unregisterPushToken();
  expect(getRegisteredPushToken()).toBeNull();
});

it('finishes an in-flight registration before unregistering on logout', async () => {
  let finish!: () => void;
  fetchMock.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const registering = registerPushToken('expo-pending', 'android');
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const unregistering = unregisterPushToken();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  finish();
  await registering;
  await unregistering;
  expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/user/push-tokens/expo-pending', {
    method: 'DELETE',
  });
  expect(getRegisteredPushToken()).toBeNull();
});
