import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** C 15 calendar against `pnpm dev:mock` (Figma 234:219, day sheet 368:2753, date sheet 368:3024). */
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

const monthButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^\d{4}년 \d{1,2}월/ });
// A date with issues in the mock month (names read "11월 4일 수요일, 이슈 2개")
const issueDay = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /일 .요일.*이슈 \d+개/ }).first();

test('header, tabs, month title, status chips, weekdays and the "?" note', async ({ page }) => {
  await page.goto('/teams/1/calendar');
  await expect(page.getByRole('link', { name: '캘린더', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(monthButton(page)).toBeVisible();
  for (const name of ['작업 전', '진행', '완료', '정지']) {
    await expect(
      page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}$`) }),
    ).toBeVisible();
  }
  await expect(page.getByRole('main').locator('ol[aria-hidden]')).toHaveText('월화수목금토일');
  await expect(page.getByRole('button', { name: /^필터/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /팀 채팅으로 가기/ })).toBeVisible();

  await page.getByRole('button', { name: '캘린더 안내' }).click();
  await expect(page.getByText('마감일이 없는 이슈는 캘린더에 보이지 않아요.')).toBeVisible();
  await expect(page.getByRole('link', { name: /일정 없음/ })).toHaveAttribute(
    'href',
    '/teams/1/issues?view=unscheduled',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByText('마감일이 없는 이슈는 캘린더에 보이지 않아요.')).toHaveCount(0);
});

test('a date opens its day sheet; an issue opens 12', async ({ page }) => {
  await page.goto('/teams/1/calendar');
  const day = issueDay(page);
  await expect(day).toBeVisible();
  await day.click();
  const sheet = page.getByRole('dialog', { name: /^\d{1,2}월 \d{1,2}일 이슈$/ });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/teams\/1\/issues\/\d+/);
});

test('the date sheet moves to the picked month through the URL', async ({ page }) => {
  await page.goto('/teams/1/calendar');
  await monthButton(page).click();
  const sheet = page.getByRole('dialog', { name: '날짜 선택' });
  await expect(sheet).toBeVisible();
  const year = sheet.getByRole('listbox', { name: '연도' });
  await year.focus();
  await page.keyboard.press('ArrowUp');
  await sheet.getByRole('button', { name: '저장' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-01/);
  const last = Number(new Date().getFullYear()) - 1;
  await expect(monthButton(page)).toContainText(`${last}년`);
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without page sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/teams/1/calendar');
    await expect(issueDay(page)).toBeVisible();
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    const check = async () =>
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.filter(
          (v) => v.id !== 'color-contrast',
        ),
      ).toEqual([]);
    // The four status chips (Figma 15) sit on one row
    const tops = await page
      .getByRole('main')
      .locator('ul > li:has(> span[aria-hidden])')
      .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(tops).toHaveLength(4);
    expect(new Set(tops).size).toBe(1);
    // The "?" sits on that row, 10px after the last chip (Figma 234:219)
    const [lastChip, help] = await Promise.all([
      page
        .getByRole('listitem')
        .filter({ hasText: /^정지$/ })
        .boundingBox(),
      page.getByRole('button', { name: '캘린더 안내' }).locator('[aria-hidden]').boundingBox(),
    ]);
    expect(Math.abs(help!.x - (lastChip!.x + lastChip!.width) - 10)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(help!.y + help!.height / 2 - (lastChip!.y + lastChip!.height / 2)),
    ).toBeLessThanOrEqual(1);
    await check();
    await page.screenshot({ path: testInfo.outputPath(`calendar-${width}.png`) });
    await issueDay(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check();
    await page.screenshot({ path: testInfo.outputPath(`calendar-${width}-day.png`) });
    await page.keyboard.press('Escape');
    await monthButton(page).click();
    await expect(page.getByRole('dialog', { name: '날짜 선택' })).toBeVisible();
    await check();
    await page.screenshot({ path: testInfo.outputPath(`calendar-${width}-date.png`) });
  });
}
