import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** C 14 status board against `pnpm dev:mock` (Figma 200:1028, menus 368:3414, 368:3562, 368:3741). */
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

const column = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(`^${name} \\d+개$`) });

test('header, tabs, 팀 변경·최신순, status columns and cards', async ({ page }) => {
  await page.goto('/teams/1/board');
  await expect(page.getByRole('link', { name: '보드', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: '팀 변경', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '상태 필터' })).toBeVisible();
  await expect(page.getByRole('button', { name: '정렬, 최신순' })).toBeVisible();
  for (const name of ['작업 전', '작업 중', '작업 중단', '작업 완료']) {
    await expect(column(page, name)).toBeAttached();
  }
  const first = column(page, '작업 전').getByRole('article').first();
  await expect(first.getByText(/담당$/)).toBeVisible();
  await expect(first.getByRole('button', { name: /^상태 작업 전, / })).toBeVisible();
  await expect(page.getByRole('link', { name: /팀 채팅으로 가기/ })).toBeVisible();
  // "+" in each column header (Figma 214:100) → 13
  await column(page, '작업 전').getByRole('link', { name: '이슈 작성' }).click();
  await expect(page).toHaveURL(/\/teams\/1\/issues\/new/);
});

test('정렬 and 필터 menus change the order and the columns through the URL', async ({ page }) => {
  await page.goto('/teams/1/board');
  const todo = column(page, '작업 전');
  const titles = () => todo.getByRole('heading', { level: 3 }).allTextContents();
  await expect(todo.getByRole('article').first()).toBeVisible();
  const latest = await titles();

  await page.getByRole('button', { name: '정렬, 최신순' }).click();
  await page.getByRole('menuitemradio', { name: '오래 된 순' }).click();
  await expect(page).toHaveURL(/[?&]sort=oldest/);
  await expect.poll(titles).toEqual([...latest].reverse());

  await page.getByRole('button', { name: '상태 필터' }).click();
  await page.getByRole('menuitemradio', { name: '작업 중', exact: true }).click();
  await expect(page).toHaveURL(/status=IN_PROGRESS/);
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(column(page, '작업 중')).toBeVisible();

  await page.getByRole('button', { name: /^상태 필터, 작업 중 칸만/ }).click();
  await page.getByRole('menuitemradio', { name: '작업 중', exact: true }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(column(page, '작업 전')).toBeVisible();
});

test('the card status menu moves a card to another column (and back)', async ({ page }) => {
  await page.goto('/teams/1/board');
  const card = column(page, '작업 전').getByRole('article').first();
  const title = (await card.getByRole('heading', { level: 3 }).textContent())!.trim();

  await card.getByRole('button', { name: new RegExp(`^상태 작업 전, `) }).click();
  await page.getByRole('menuitemradio', { name: '작업 중단' }).click();
  await expect(column(page, '작업 중단').getByRole('heading', { name: title })).toBeVisible();

  const moved = column(page, '작업 중단').getByRole('article').filter({ hasText: title });
  await expect(moved).toHaveAttribute('aria-busy', 'false');
  await moved.getByRole('button', { name: /^상태 작업 중단, / }).click();
  await page.getByRole('menuitemradio', { name: '작업 전' }).click();
  await expect(column(page, '작업 전').getByRole('heading', { name: title })).toBeVisible();
});

test('a card can be dragged to another column (and back)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 600, height: 1000 });
  await page.goto('/teams/1/board');
  const card = column(page, '작업 전').getByRole('article').first();
  const title = (await card.getByRole('heading', { level: 3 }).textContent())!.trim();

  async function drag(from: string, to: string) {
    const source = column(page, from).getByRole('article').filter({ hasText: title });
    const box = (await source.boundingBox())!;
    const target = (await column(page, to).getByRole('heading', { level: 2 }).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + 10, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height + 20, {
      steps: 10,
    });
    await page.mouse.up();
  }

  await drag('작업 전', '작업 중');
  await expect(column(page, '작업 중').getByRole('heading', { name: title })).toBeVisible();
  // Saved to GitHub (mock) before the card can be picked up again
  await expect(
    column(page, '작업 중').getByRole('article').filter({ hasText: title }),
  ).toHaveAttribute('aria-busy', 'false');
  await drag('작업 중', '작업 전');
  await expect(column(page, '작업 전').getByRole('heading', { name: title })).toBeVisible();
});

test('read-only team: the status menu stays closed and explains why', async ({ page }) => {
  await page.goto('/teams/2/board');
  const status = page.getByRole('main').getByRole('button', { name: /^상태 작업/ }).first();
  await expect(status).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('link', { name: '이슈 작성' })).toHaveCount(0);
  // aria-disabled stays focusable and pressable (Playwright won't click it), so press it from the keyboard
  await status.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(
    page.getByText('이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.', { exact: true }),
  ).toBeVisible();
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without page sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/teams/1/board');
    await expect(column(page, '작업 전').getByRole('article').first()).toBeVisible();
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    // Columns pan (overflow auto) with scrollbar hidden; page itself does not grow
    expect(
      await page.evaluate(() => {
        const column = document.querySelector('main section[aria-labelledby^="board-column-"]');
        const row = column?.parentElement;
        if (!row) return false;
        const style = getComputedStyle(row);
        row.scrollLeft = 9999;
        const canPan = row.scrollLeft > 0;
        row.scrollLeft = 0;
        return style.overflowX === 'auto' && style.scrollbarWidth === 'none' && canPan;
      }),
    ).toBe(true);
    const { violations } = await new AxeBuilder({ page }).analyze();
    // Low-contrast Figma colors are kept on purpose (work log); everything else must pass
    expect(violations.filter((v) => v.id !== 'color-contrast')).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`board-${width}.png`) });
    for (const [name, menu] of [
      ['정렬, 최신순', 'sort'],
      ['상태 필터', 'filter'],
    ] as const) {
      await page.getByRole('button', { name }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).analyze()).violations.filter(
          (v) => v.id !== 'color-contrast',
        ),
      ).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`board-${width}-${menu}.png`) });
      await page.keyboard.press('Escape');
    }
  });
}
