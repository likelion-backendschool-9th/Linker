import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
async function unlock(page: Page) {
  await page.getByLabel('인증 코드', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '운영 로그', exact: true })).toBeVisible();
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1568, height: 1004 });
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'operator', url: 'http://localhost:3000' }]);
});
test('27 matches the supplied audit table, stays read-only and keeps the common shell', async ({
  page,
}, info) => {
  await page.goto('/admin/audit');
  await expect(page.getByRole('table')).toHaveCount(0);
  await unlock(page);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('운영 기록은 수정하거나 삭제할 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText([
    '시각',
    '운영자',
    '대상',
    '조치',
    '사유',
  ]);
  await expect(page.getByRole('button', { name: /^(수정|삭제|저장)$/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '운영 메뉴' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await capture(page, info, 'audit-main-1568');
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, 'audit-main-1280');
});
test('27 filters use numeric operator IDs and backend action enum values', async ({
  page,
}, info) => {
  await page.goto('/admin/audit');
  await unlock(page);
  await page.getByLabel('운영자', { exact: true }).selectOption('2');
  await expect(page).toHaveURL(/adminId=2/);
  await page.getByLabel('조치 유형', { exact: true }).selectOption('VIEW_EMAIL');
  await expect(page).toHaveURL(/actionType=VIEW_EMAIL/);
  await expect(page.getByRole('table').getByText('결제 문의 확인')).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await capture(page, info, 'audit-filtered-1568');
  await page.reload();
  await unlock(page);
  await expect(page.getByLabel('운영자', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('조치 유형', { exact: true })).toHaveValue('VIEW_EMAIL');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page).toHaveURL('/admin/audit');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(6);
});
test('27 validates reversed dates and resets every filter including current-page search', async ({
  page,
}, info) => {
  await page.goto('/admin/audit');
  await unlock(page);
  await page.getByLabel('시작일 (KST)').fill('2026-11-02');
  await page.getByLabel('종료일 (KST)').fill('2026-11-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('종료일은 시작일 이후로');
  await expect(page.getByRole('table')).toHaveCount(0);
  await capture(page, info, 'audit-invalid-range-1568');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.getByRole('searchbox', { name: '대상 또는 사유 검색' }).fill('결제');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByText('현재 페이지 1건')).toBeVisible();
  await page.getByRole('searchbox', { name: '대상 또는 사유 검색' }).fill('없는대상문구');
  await expect(page.getByText('조건에 맞는 조치 기록이 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('table')).toBeVisible();
});
