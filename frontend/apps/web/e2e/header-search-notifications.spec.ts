import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' },
  ]);
});

test('header search from another tab finds titles, retains the URL and clears the filter', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/workspace');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('searchbox', { name: '검색어를 입력해 주세요' }).fill('  spring  ');
  await page.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL('/feed?q=spring');
  await expect(page.getByRole('article', { name: 'Spring Boot로 만든 STOMP 채팅 서버' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Show moa', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('spring');
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({
    path: info.outputPath('feed-title-search.png'),
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(page).toHaveURL('/feed');
  await expect(page.getByRole('article', { name: 'Show moa', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/feed?q=spring');
  await expect(page.getByRole('article', { name: 'Spring Boot로 만든 STOMP 채팅 서버' })).toBeVisible();
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
