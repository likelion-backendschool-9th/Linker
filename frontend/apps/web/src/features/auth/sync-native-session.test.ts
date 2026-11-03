import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, postToNative } from '@/lib/bridge/native';
import { unregisterPushToken } from '@/features/notifications/push-tokens';

import { clearNativeSession, saveNativeSession, unregisterNativePushToken } from './sync-native-session';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/bridge/native', () => ({
  isInApp: vi.fn(),
  postToNative: vi.fn(),
}));
vi.mock('@/features/notifications/push-tokens', () => ({
  unregisterPushToken: vi.fn(),
}));

const fetchMock = vi.mocked(apiFetch);
const inApp = vi.mocked(isInApp);
const post = vi.mocked(postToNative);
const unregister = vi.mocked(unregisterPushToken);

beforeEach(() => {
  fetchMock.mockReset();
  inApp.mockReset();
  post.mockReset();
  unregister.mockReset();
});

it('saves the native session only inside the app', async () => {
  inApp.mockReturnValue(true);
  fetchMock.mockResolvedValue({ userId: 7, userType: 'DEVELOPER' });
  await saveNativeSession();
  expect(post).toHaveBeenCalledWith({
    type: 'AUTH_SESSION_SAVE',
    session: { userId: 7, userType: 'DEVELOPER' },
  });
});

it('skips saveNativeSession in the browser', async () => {
  inApp.mockReturnValue(false);
  await saveNativeSession();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

it('unregisters the push token and clears the native session separately', async () => {
  await unregisterNativePushToken();
  expect(unregister).toHaveBeenCalled();
  clearNativeSession();
  expect(post).toHaveBeenCalledWith({ type: 'AUTH_SESSION_CLEAR' });
});
