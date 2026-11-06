import { apiFetch } from '@/lib/api/api-fetch';
import { isInApp, postToNative } from '@/lib/bridge/native';
import { unregisterPushToken } from '@/features/notifications/push-tokens';

import {
  clearNativeSession,
  saveNativeSession,
  syncNativeSession,
  unregisterNativePushToken,
} from './sync-native-session';

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

it('does not restore a logged-out account when an older /me request finishes late', async () => {
  inApp.mockReturnValue(true);
  let finish!: (session: { userId: number; userType: 'DEVELOPER' }) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const saving = saveNativeSession();
  clearNativeSession();
  finish({ userId: 7, userType: 'DEVELOPER' });
  await saving;
  expect(post.mock.calls).toEqual([[{ type: 'AUTH_SESSION_CLEAR' }]]);
});

it('keeps the newer account when two session lookups finish in reverse order', async () => {
  inApp.mockReturnValue(true);
  let finishOld!: (session: { userId: number; userType: 'DEVELOPER' }) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      finishOld = resolve;
    }),
  );
  const oldSave = saveNativeSession();
  fetchMock.mockResolvedValueOnce({ userId: 8, userType: 'RECRUITER' });
  await saveNativeSession();
  finishOld({ userId: 7, userType: 'DEVELOPER' });
  await oldSave;
  expect(post.mock.calls).toEqual([
    [
      {
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 8, userType: 'RECRUITER' },
      },
    ],
  ]);
});

it('lets a Provider session update supersede an older login lookup', async () => {
  inApp.mockReturnValue(true);
  let finish!: (session: { userId: number; userType: 'DEVELOPER' }) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const saving = saveNativeSession();
  syncNativeSession({ userId: 8, userType: 'RECRUITER' });
  finish({ userId: 7, userType: 'DEVELOPER' });
  await saving;
  expect(post.mock.calls).toEqual([
    [
      {
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 8, userType: 'RECRUITER' },
      },
    ],
  ]);
});
