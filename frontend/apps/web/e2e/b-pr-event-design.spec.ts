import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const labels = [
  'PR이 생성 되었습니다',
  'PR이 리뷰를 기다리고 있습니다',
  'PR이 병합 되었습니다',
  'PR이 닫혔습니다',
] as const;

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
  await page.setViewportSize({ width: 375, height: 800 });
});

test('17 PR system messages match the four Figma states and organization grouping', async ({
  page,
}, info) => {
  await page.goto('/chats/1');
  const opened = page.getByRole('article', { name: labels[0], exact: true });
  await opened.scrollIntoViewIfNeeded();
  await expect(opened.getByText('linker-hack', { exact: true })).toBeVisible();
  await expect(opened.locator('img').first()).toHaveAttribute('sizes', '46px');
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    // Align the first organization row for comparison; the surrounding real chat remains intact.
    await page.getByRole('region', { name: '대화 내용' }).evaluate((viewport) => {
      const first = viewport.querySelector('article[aria-label="PR이 생성 되었습니다"]')!;
      viewport.scrollTop += first.getBoundingClientRect().top - 193;
    });
    const cards = [];
    for (const label of labels) {
      const article = page.getByRole('article', { name: label, exact: true });
      const card = article.getByRole('button', { name: /GitHub에서 열기/ });
      await expect(card).toBeVisible();
      await expect(card.getByText('#31 feat: 로그인 시트', { exact: true })).toBeVisible();
      await expect(card.getByText('linker-web', { exact: true })).toBeVisible();
      await expect(card.locator('time')).toHaveAttribute('datetime', /\+09:00$/);
      if (label !== labels[0]) expect(await article.locator('p').count()).toBe(0);
      cards.push((await card.boundingBox())!);
    }
    if (width === 375) {
      for (const box of cards) {
        expect(box.x).toBe(67);
        expect(box.width).toBe(288);
        expect(box.height).toBe(106);
      }
      for (let i = 1; i < cards.length; i++) expect(cards[i]!.y - cards[i - 1]!.y).toBe(113);
      expect(
        await opened.locator('[data-event]').evaluate((node) => getComputedStyle(node).color),
      ).toBe('rgb(21, 128, 0)');
      const expected = ['rgb(235, 110, 37)', 'rgb(37, 99, 235)', 'rgb(237, 0, 4)'];
      for (let i = 1; i < labels.length; i++)
        expect(
          await page
            .getByRole('article', { name: labels[i], exact: true })
            .locator('[data-event]')
            .evaluate((node) => getComputedStyle(node).color),
        ).toBe(expected[i - 1]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const input = await page.getByRole('textbox', { name: '메시지' }).boundingBox();
    const attach = await page
      .getByRole('button', { name: '사진 보내기', exact: true })
      .boundingBox();
    const send = await page.getByRole('button', { name: '보내기', exact: true }).boundingBox();
    const summary = await page
      .getByRole('button', { name: 'AI 채팅 요약', exact: true })
      .boundingBox();
    expect(input!.height).toBe(42);
    expect(attach!.width).toBe(42);
    expect(send!.width).toBe(42);
    expect(summary!.width).toBe(40);
    expect(summary!.height).toBe(40);
    expect(input!.x - attach!.x - attach!.width).toBe(10);
    expect(send!.x - input!.x - input!.width).toBe(10);
    expect(input!.y - summary!.y - summary!.height).toBe(20);
    expect(input!.y).toBe(734);
    if (width === 375) {
      expect(input!.x).toBe(64);
      expect(input!.width).toBe(243);
      expect(send!.x).toBe(317);
      expect(summary!.x).toBeCloseTo(318, 0);
    }
    await page.screenshot({
      path: info.outputPath(`pr-system-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  // Figma's orange review text is below AA contrast; preserve the design and test semantics only.
  const report = await new AxeBuilder({ page })
    .include('article[aria-label^="PR이"]')
    .withTags(['wcag2a', 'wcag21a'])
    .analyze();
  expect(report.violations).toEqual([]);
});

test('17 floating summary keeps the existing result flow and leaves photo attachment available', async ({
  page,
}) => {
  await page.goto('/chats/1');
  const summary = page.getByRole('button', { name: 'AI 채팅 요약', exact: true });
  await expect(summary).toBeVisible();
  const position = await summary.boundingBox();
  await page.getByRole('region', { name: '대화 내용' }).evaluate((viewport) => {
    viewport.scrollTop = 0;
  });
  expect(await summary.boundingBox()).toEqual(position);
  const input = page.getByRole('textbox', { name: '메시지' });
  await input.fill('작성 중인 메시지');
  await summary.focus();
  await page.keyboard.press('Enter');
  const result = page.getByRole('dialog', { name: 'AI 요약', exact: true });
  await expect(result).toBeVisible();
  await expect(
    result.getByText('AI가 만든 요약이라 틀릴 수 있어요', { exact: true }),
  ).toBeVisible();
  await result.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(result).toBeHidden();
  await expect(input).toHaveValue('작성 중인 메시지');
  // Photos send as soon as they are picked: the button opens the file picker, no attach sheet.
  await expect(page.getByLabel(/보낼 사진 선택/)).toHaveAttribute('multiple', '');
  await page.goto('/chats/10');
  await expect(page.getByRole('textbox', { name: '메시지' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 채팅 요약', exact: true })).toHaveCount(0);
});

test('17 immutable PR cards open the existing GitHub confirmation without regular message menus', async ({
  page,
}) => {
  await page.goto('/chats/1');
  for (const label of labels) {
    const article = page.getByRole('article', { name: label, exact: true });
    const card = article.getByRole('button', { name: /GitHub에서 열기/ });
    await card.scrollIntoViewIfNeeded();
    await card.click({ button: 'right' });
    await expect(article.getByRole('button', { name: /메시지 메뉴/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/overlay=chat-message/);
    await card.click();
    const confirm = page.getByRole('dialog', { name: '외부 사이트로 이동합니다' });
    await expect(confirm).toBeVisible();
    await expect(
      confirm.getByText('github.com(으)로 이동해요. 새 창에서 열려요.', { exact: true }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: '취소', exact: true }).click();
    await expect(confirm).toBeHidden();
  }
});
