import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// End-of-D2 check, guest side (blueprint §1-1). Member checks need the backend session.

test('empty /feed renders in PageFrame with landmarks, skip link and no axe violations', async ({
  page,
}) => {
  await page.goto('/feed');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('guest opening /workspace sees the login sheet over /feed with returnTo', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/feed\?overlay=login&returnTo=%2Fworkspace/);
  await expect(
    page.getByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' }),
  ).toBeVisible();
});

test('guest opening /admin gets 404', async ({ page }) => {
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('삭제되었거나 볼 수 없는 콘텐츠예요')).toBeVisible();
});

test('sheet closed with X, then back: it stays closed and the previous page shows', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: '둘러보기' }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.getByRole('button', { name: '로그인' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});
