import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' },
  ]);
});

test('tab headers have no search icon', async ({ page }) => {
  for (const path of ['/feed', '/recruits', '/workspace', '/chats']) {
    await page.goto(path);
    await expect(page.getByRole('banner').getByRole('button', { name: '검색', exact: true })).toHaveCount(0);
  }
});

test('title search excludes body-only matches and works for guests', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/feed?q=' + encodeURIComponent('재연결 시 놓친 메시지를'));
  await expect(page.getByText('검색 결과가 없어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.goto('/feed?q=' + encodeURIComponent('CLI'));
  await expect(page.getByRole('article', { name: '디자인 토큰 → CSS 변수 변환 CLI' })).toBeVisible();
});

test('header bell opens notifications and all-read updates the badge', async ({ page }, info) => {
  await page.goto('/feed');
  await page.getByRole('link', { name: '알림 (안 읽은 알림 있음)', exact: true }).click();
  await expect(page).toHaveURL('/notifications');
  await expect(page.getByRole('region', { name: '알림 목록' })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('header-notifications.png'),
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.getByRole('button', { name: '전체 읽기', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '읽지 않은 알림 0개' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible();
});
