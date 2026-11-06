import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const origin = process.env.E2E_ORIGIN ?? 'http://localhost:3000';

async function role(page: Page, value: 'guest' | 'developer' | 'recruiter') {
  await page.context().addCookies([{ name: 'linker_mock_role', value, url: origin }]);
}

test('guests are sent to login instead of seeing the chat list', async ({ page }) => {
  await role(page, 'guest');
  await page.goto('/chats');
  await expect(page).toHaveURL(/login/);
});

test('developers switch tabs, open a room and come back on a phone-sized screen', async ({
  page,
}) => {
  await role(page, 'developer');
  await page.goto('/chats');
  await expect(page.getByRole('navigation', { name: '채팅 종류' })).toBeVisible();
  await expect(page.getByRole('region', { name: '팀 채팅 목록' })).toBeVisible();
  // No horizontal scroll at 360px
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('button', { name: /^요청/ }).click();
  await expect(page).toHaveURL(/tab=REQUEST/);
  await expect(page.getByRole('region', { name: '요청 채팅 목록' })).toBeVisible();

  await page.getByRole('button', { name: '팀', exact: true }).click();
  const room = page.getByRole('region', { name: '팀 채팅 목록' }).getByRole('link').first();
  await room.click();
  await expect(page).toHaveURL(/\/chats\/\d+/);
  await page.goBack();
  await expect(page).toHaveURL(/\/chats/);
  await expect(page.getByRole('region', { name: '팀 채팅 목록' })).toBeVisible();
});

test('a received request can be accepted from the list', async ({ page }) => {
  await role(page, 'developer');
  await page.goto('/chats?tab=REQUEST');
  const accept = page.getByRole('button', { name: /요청 수락/ }).first();
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(page.getByText('메시지 요청을 수락했어요.', { exact: true })).toBeVisible();
});

test('recruiters only get the personal tab, even from a TEAM URL', async ({ page }) => {
  await role(page, 'recruiter');
  await page.goto('/chats?tab=TEAM');
  await expect(page.getByRole('region', { name: '개인 채팅 목록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '팀', exact: true })).toHaveCount(0);
});

test('the chat list has no accessibility violations', async ({ page }) => {
  await role(page, 'developer');
  await page.goto('/chats');
  await expect(page.getByRole('region', { name: '팀 채팅 목록' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
