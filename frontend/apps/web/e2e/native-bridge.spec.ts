import type { WebToNative } from '@linker/bridge';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    linkerBridgeMessages?: WebToNative[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const messages: WebToNative[] = [];
    window.linkerBridgeMessages = messages;
    Object.defineProperty(window, 'ReactNativeWebView', {
      value: { postMessage: (raw: string) => messages.push(JSON.parse(raw).msg) },
    });
  });
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
