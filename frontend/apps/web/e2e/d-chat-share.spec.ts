import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const origin = 'http://localhost:3142';
async function login(page: Page, role: 'guest' | 'developer' | 'recruiter') {
  await page.context().addCookies([{ name: 'linker_mock_role', value: role, url: origin }]);
}

for (const width of [360, 600]) {
  test(`shares a post to a room and renders the card at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await login(page, 'developer');
    await page.goto('/posts/1');
    await page.getByRole('button', { name: '공유', exact: true }).click();
    await expect(page).toHaveURL(/overlay=share/);
    await page.getByRole('button', { name: '채팅방에 공유', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: '채팅방 이름' })).toBeFocused();
    const picker = page.getByRole('dialog', { name: '채팅방에 공유' });
    await expect(picker.getByRole('button', { name: /팀 채팅방에 공유/ }).first()).toBeVisible();
    const violations = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(violations.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await picker
      .getByRole('button', { name: /팀 채팅방에 공유/ })
      .first()
      .click();
    await expect(picker).not.toBeVisible();
    await page.getByRole('button', { name: '채팅방으로 가기', exact: true }).click();
    await expect(page).toHaveURL(/\/chats\/\d+$/);
    const card = page.getByRole('link', { name: /게시물: linker-hack\/linker-web/ }).last();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', '/posts/1?from=chat_share');
  });
}

test('switches share → picker with replace and restores the trigger after closing', async ({
  page,
}) => {
  await login(page, 'developer');
  await page.goto('/recruits/1');
  const trigger = page.getByRole('button', { name: '공유', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: '채팅방에 공유', exact: true }).click();
  await expect(page).toHaveURL(/overlay=share-room/);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL(/\/recruits\/1$/);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: '채팅방에 공유', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/recruits\/1$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('guest profile sharing offers copy and routes chat sharing to login', async ({ page }) => {
  await login(page, 'guest');
  await page.goto('/user/doyun-lee');
  await page.getByRole('button', { name: '공유', exact: true }).click();
  await expect(page.getByRole('button', { name: '링크 복사', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '채팅방에 공유', exact: true }).click();
  await expect(page).toHaveURL(/overlay=login/);
});

test('recruiter room picker contains only open personal rooms', async ({ page }) => {
  await login(page, 'recruiter');
  await page.goto('/posts/1');
  await page.getByRole('button', { name: '공유', exact: true }).click();
  await page.getByRole('button', { name: '채팅방에 공유', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '채팅방에 공유' });
  await expect(picker.getByRole('button', { name: /개인 채팅방에 공유/ }).first()).toBeVisible();
  await expect(picker.getByRole('button', { name: /팀 채팅방에 공유/ })).toHaveCount(0);
});
