import type { WebToNative } from '@linker/bridge';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    linkerBridgeMessages?: WebToNative[];
  }
}

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((alreadyExplained: boolean) => {
    // Existing login/back tests start after first-launch onboarding; dedicated cases cover it below.
    if (alreadyExplained) localStorage.setItem('linker:push-permission-seen', 'true');
    const messages: WebToNative[] = [];
    window.linkerBridgeMessages = messages;
    Object.defineProperty(window, 'ReactNativeWebView', {
      value: { postMessage: (raw: string) => messages.push(JSON.parse(raw).msg) },
    });
  }, !info.title.startsWith('Android first-launch'));
});

test('Android first-launch permission waits for consent, closes on grant and stays dismissed after reload', async ({
  page,
}) => {
  await page.goto('/api/mock/login/developer?returnTo=/feed');
  const sheet = page.getByRole('dialog', { name: '푸시 알림', exact: true });
  await expect(sheet).toBeVisible();
  expect(
    (await page.evaluate(() => window.linkerBridgeMessages ?? [])).filter(
      (msg) => msg.type === 'PUSH_PERMISSION_REQUEST',
    ),
  ).toHaveLength(0);
  await sheet.getByRole('button', { name: '알림 허용하기' }).click();
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages ?? []))
    .toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'PUSH_PERMISSION_REQUEST' })]),
    );
  const request = (await page.evaluate(() => window.linkerBridgeMessages ?? [])).find(
    (msg) => msg.type === 'PUSH_PERMISSION_REQUEST',
  );
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            v: 1,
            source: 'linker',
            msg: { type: 'RESULT', id, ok: true, payload: { status: 'granted' } },
          }),
        }),
      ),
    request!.id,
  );
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/feed$/);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages ?? []))
    .toContainEqual({ type: 'READY' });
  await expect(sheet).toBeHidden();
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'DEEP_LINK', path: '/notifications' },
        }),
      }),
    ),
  );
  await expect(page).toHaveURL(/\/notifications$/);
});

test('Android first-launch permission yields to login and closes through hardware back', async ({
  page,
}) => {
  await page.goto('/workspace');
  const login = page.getByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' });
  await expect(login).toBeVisible();
  await expect(page.getByRole('dialog', { name: '푸시 알림', exact: true })).toBeHidden();
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'BACK_PRESSED', id: 'login-back' },
        }),
      }),
    ),
  );
  const permission = page.getByRole('dialog', { name: '푸시 알림', exact: true });
  await expect(permission).toBeVisible();
  await expect(page).toHaveURL(/overlay=push-permission/);
  // Native dispatch does not await the old document after a real history navigation.
  await page.evaluate(() => {
    setTimeout(
      () =>
        window.dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({
              v: 1,
              source: 'linker',
              msg: { type: 'BACK_PRESSED', id: 'permission-back' },
            }),
          }),
        ),
      0,
    );
  });
  await expect(permission).toBeHidden();
  await expect(page).toHaveURL(/\/feed$/);
  expect(await page.evaluate(() => localStorage.getItem('linker:push-permission-seen'))).toBe(
    'true',
  );
});

test('hardware back closes E’s login sheet and then leaves history handling to the app', async ({
  page,
}) => {
  await page.goto('/workspace');
  const sheet = page.getByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' });
  await expect(sheet).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'BACK_PRESSED', id: 'back1' },
        }),
      }),
    ),
  );
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/feed$/);
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages))
    .toContainEqual({ type: 'BACK_RESULT', id: 'back1', handled: true });

  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'BACK_PRESSED', id: 'back2' },
        }),
      }),
    ),
  );
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages))
    .toContainEqual({ type: 'BACK_RESULT', id: 'back2', handled: false });
});

test('the session Provider sends account identifiers rather than a JWT to the app', async ({
  page,
}) => {
  await page.goto('/api/mock/login/developer?returnTo=/feed');
  await expect(page).toHaveURL(/\/feed$/);
  expect(
    (await page.context().cookies(page.url())).find((cookie) => cookie.name === 'linker_mock_role')
      ?.value,
  ).toBe('developer');
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages))
    .toContainEqual({ type: 'AUTH_SESSION_SAVE', session: { userId: 1, userType: 'DEVELOPER' } });
});

test('GitHub login follows the existing same-origin mock response inside the WebView', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'GitHub로 시작' }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.linkerBridgeMessages))
    .toContainEqual({ type: 'AUTH_SESSION_SAVE', session: { userId: 1, userType: 'DEVELOPER' } });
});
