import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** C 11 team issue list against `pnpm dev:mock` (Figma 197:66, 368:1716, 368:1891). */
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('Flex team: header, tabs, status cards, trend, list and chat shortcut', async ({ page }) => {
  await page.goto('/teams/1/issues');
  await expect(
    page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '이슈', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: /^전체 이슈 \d+개$/ })).toBeVisible();
  await expect(page.getByText(/^\d+개 완료$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 추이 근 2주' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^이슈 목록 \d+개$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^전체 \d+$/, pressed: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /팀 채팅으로 가기/ })).toBeVisible();
});

test('Free team gets the cards but no trend', async ({ page }) => {
  await page.goto('/teams/2/issues');
  await expect(page.getByText(/^\d+개 완료$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^이슈 목록/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /최근 추이/ })).toHaveCount(0);
});

test('search and status chips narrow the list through the URL', async ({ page }) => {
  await page.goto('/teams/1/issues');
  const rows = page.getByRole('main').getByRole('article');
  await expect(rows.first()).toBeVisible();
  const firstTitle = (await rows.first().getByRole('heading').textContent())!.trim();

  await page.getByRole('searchbox', { name: '이슈 제목 검색' }).fill(firstTitle);
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(rows.first().getByRole('heading')).toHaveText(firstTitle);

  await page.getByRole('searchbox', { name: '이슈 제목 검색' }).fill('');
  await page.getByRole('button', { name: /^진행/ }).click();
  await expect(page).toHaveURL(/status=IN_PROGRESS/);
  await expect(page.getByRole('button', { name: /^진행/, pressed: true })).toBeVisible();

  // No "일정 없음" chip (Figma 11)
  await expect(page.getByRole('button', { name: /일정 없음/ })).toHaveCount(0);
});

test('the header filter icon opens the filter sheet; the team name opens "팀 변경"', async ({
  page,
}) => {
  await page.goto('/teams/1/issues');
  await page.getByRole('button', { name: '필터', exact: true }).click();
  // Escape reaches the sheet once its focus trap has moved focus to "닫기"
  await expect(page.getByRole('dialog').getByRole('button', { name: '닫기' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ }).click();
  const sheet = page.getByRole('dialog', { name: '팀 변경' });
  await expect(sheet.getByRole('radio', { name: 'Linker 해커톤팀' })).toBeChecked();
  await expect(sheet.getByRole('button', { name: '팀 변경', exact: true })).toBeVisible();
});

test('the 15 calendar link still opens the 일정 없음 list with "프로젝트에 추가"', async ({ page }) => {
  await page.goto('/teams/1/calendar');
  await page.getByRole('link', { name: /일정 없음/ }).click();
  await expect(page).toHaveURL(/\/teams\/1\/issues\?view=unscheduled/);
  await expect(page.getByRole('button', { name: /^프로젝트에 추가/ }).first()).toBeVisible();
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1163 });
    await page.goto('/teams/1/issues');
    await expect(page.getByRole('heading', { name: '최근 추이 근 2주' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('article').first()).toBeVisible();
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    const { violations } = await new AxeBuilder({ page }).analyze();
    // Low-contrast Figma colors are kept on purpose (work log); everything else must pass
    expect(violations.filter((v) => v.id !== 'color-contrast')).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`issues-${width}.png`), fullPage: true });
    await page.getByRole('searchbox', { name: '이슈 제목 검색' }).focus();
    await page.screenshot({ path: testInfo.outputPath(`issues-${width}-focus.png`) });
    await page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ }).click();
    await expect(page.getByRole('dialog', { name: '팀 변경' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`issues-${width}-sheet.png`) });
  });
}
