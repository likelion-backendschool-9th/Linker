import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** C 12 issue detail against `pnpm dev:mock` (Figma 12, 198:486; sheets follow Figma 13). */
// The first visit compiles the route in dev mode
test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

// An issue with sub-issues in the mock (list → first row with a sub-issue progress)
async function openDetail(page: Page, teamId = 1) {
  await page.goto(`/teams/${teamId}/issues`);
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(`/teams/${teamId}/issues/\\d+`));
  await expect(page.getByRole('heading', { level: 3, name: '이슈 본문' })).toBeVisible();
}

test('header, title with the GitHub link, info lines, body and sub-issues', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByRole('heading', { level: 1, name: '이슈 상세' })).toBeVisible();
  await expect(page.getByRole('button', { name: /GitHub에서 열기/ })).toBeVisible();
  for (const name of [/^상태 /, /^라벨/, /^담당자/, /^시작일/, /^마감일/]) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  // Figma has no 채팅방 공유 yet (17)
  await expect(page.getByText('채팅방 공유')).toHaveCount(0);
});

test('demo issue 1022: sub-issue progress, dates and a red overdue due date', async ({ page }) => {
  await page.goto('/teams/1/issues/1022');
  await expect(page.getByText('1/3 완료')).toBeVisible();
  await expect(page.getByRole('main').getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^시작일 \d{4}년/ })).toBeVisible();
  await expect(page.locator('[data-overdue="true"]')).toBeVisible();
});

test('an info line opens its sheet; the status sheet saves and closes', async ({ page }) => {
  await openDetail(page);
  await page.getByRole('button', { name: /^상태 / }).click();
  const sheet = page.getByRole('dialog', { name: '이슈 상태' });
  await expect(sheet).toBeVisible();
  await sheet.locator('label').filter({ hasText: '작업 중단' }).click();
  await sheet.getByRole('button', { name: '완료' }).click();
  await expect(sheet).toHaveCount(0);
});

test('read-only team: the info lines explain why and open nothing', async ({ page }) => {
  await openDetail(page, 2);
  const line = page.getByRole('button', { name: /^담당자/ });
  await expect(line).toHaveAttribute('aria-disabled', 'true');
  // aria-disabled stays focusable and pressable (Playwright won't click it), so press it from the keyboard
  await line.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without page sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    await openDetail(page);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    const check = async () =>
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.filter(
          (v) => v.id !== 'color-contrast' && v.id !== 'landmark-unique',
        ),
      ).toEqual([]);
    await check();
    await page.screenshot({ path: testInfo.outputPath(`detail-${width}.png`), fullPage: true });
    await page
      .getByRole('button', { name: /^일정|^시작일/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check();
    await page.screenshot({ path: testInfo.outputPath(`detail-${width}-sheet.png`) });
  });
}
