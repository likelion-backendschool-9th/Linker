import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const labels = [
  'PR이 생성 되었습니다',
  'PR이 리뷰를 기다리고 있습니다',
  'PR이 병합 되었습니다',
  'PR이 닫혔습니다',
] as const;

/** A solid PNG drawn in the page, for the photo picker */
async function png(page: Page, width: number, height: number, color: string) {
  const base64 = await page.evaluate(
    ([w, h, fill]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d')!;
      context.fillStyle = fill;
      context.fillRect(0, 0, w, h);
      return canvas.toDataURL('image/png').split(',')[1]!;
    },
    [width, height, color] as const,
  );
  return {
    name: `${width}x${height}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  };
}

async function revealPrEvents(page: Page) {
  const timeline = page.getByRole('region', { name: '대화 내용' });
  await expect(timeline).toBeVisible();
  // The latest composer is taller; scroll the virtual timeline before finding older PR rows.
  await timeline.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('article', { name: labels[0], exact: true })).toBeAttached();
}

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
  await revealPrEvents(page);
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
    for (const box of cards)
      expect(box.width).toBeLessThanOrEqual(Math.min(320, Math.min(width, 600) - 87));
    if (width === 375) {
      for (const box of cards) {
        expect(box.x).toBe(67);
        expect(box.width).toBeLessThan(288);
        expect(box.height).toBe(106);
      }
      for (let i = 1; i < cards.length; i++) expect(cards[i]!.y - cards[i - 1]!.y).toBe(113);
      expect(cards[0]!.width).toBeLessThan(cards[1]!.width);
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
    const attach = await page.getByRole('button', { name: '사진 첨부', exact: true }).boundingBox();
    const send = await page.getByRole('button', { name: '보내기', exact: true }).boundingBox();
    const summary = await page
      .getByRole('button', { name: 'AI 채팅 요약', exact: true })
      .boundingBox();
    // "AI 채팅 요약" floats 8px above the composer (12px top padding), centered on send;
    // the input stays one row tall (user request 2026-11-10)
    expect(input!.height).toBe(42);
    expect(attach!.width).toBe(42);
    expect(send!.width).toBe(42);
    expect(summary!.width).toBe(40);
    expect(summary!.height).toBe(40);
    expect(input!.x - attach!.x - attach!.width).toBe(10);
    expect(send!.x - input!.x - input!.width).toBe(10);
    expect(input!.y - summary!.y - summary!.height).toBe(20);
    expect(summary!.x + summary!.width / 2).toBeCloseTo(send!.x + send!.width / 2, 0);
    // 800px viewport − 28px bottom padding − 42px bar
    expect(input!.y).toBe(730);
    if (width === 375) {
      expect(input!.x).toBe(64);
      expect(input!.width).toBe(243);
      expect(send!.x).toBe(317);
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

test('17 system cards cap wide screens and contain long titles and repository names', async ({
  page,
}, info) => {
  const longTitle =
    '#31 로그인 실패와 조직 권한 예외를 함께 처리하고 재접속 시 중복 알림과 잘못된 상태 갱신을 방지하는 시스템 메시지 개선';
  const longRepository = 'repository-without-spaces-'.repeat(12);
  for (const width of [320, 360, 375, 414, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/chats/1');
    await revealPrEvents(page);
    await page.getByRole('article', { name: labels[0], exact: true }).scrollIntoViewIfNeeded();
    for (const label of labels) {
      const card = page
        .getByRole('article', { name: label, exact: true })
        .getByRole('button', { name: /GitHub에서 열기/ });
      // Stress the rendered CSS without changing shared mock fixtures or message contracts.
      const title = card.getByTitle('#31 feat: 로그인 시트', { exact: true });
      await title.evaluate(
        (node, text) => {
          node.textContent = text;
        },
        width === 320 ? `#31 ${'VeryLongUnbrokenPullRequestTitle'.repeat(10)}` : longTitle,
      );
      const repository = card.getByTitle('linker-hack/linker-web', { exact: true });
      await repository.evaluate((node, text) => {
        node.textContent = text;
      }, longRepository);
      const metrics = await title.evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        line: Number.parseFloat(getComputedStyle(node).lineHeight),
        full: node.scrollHeight,
      }));
      expect(metrics.height).toBe(metrics.line * 2);
      expect(metrics.full).toBeGreaterThan(metrics.height);
      expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(await repository.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      expect((await card.boundingBox())!.width).toBe(Math.min(320, Math.min(width, 600) - 87));
      const repoBox = (await repository.boundingBox())!;
      const timeBox = (await card.locator('time').boundingBox())!;
      expect(timeBox.x).toBeGreaterThan(repoBox.x + repoBox.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`pr-system-long-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
    const opened = page
      .getByRole('article', { name: labels[0], exact: true })
      .getByRole('button', { name: /GitHub에서 열기/ });
    const expanded = (await opened.boundingBox())!;
    await opened.getByTitle('#31 feat: 로그인 시트', { exact: true }).evaluate((node) => {
      node.textContent = '#1 a';
    });
    await opened.getByTitle('linker-hack/linker-web', { exact: true }).evaluate((node) => {
      node.textContent = 'r';
    });
    const compact = (await opened.boundingBox())!;
    expect(compact.width).toBeLessThan(expanded.width);
    expect(compact.height).toBeLessThan(expanded.height);
  }
});

test('17 floating summary keeps the existing result flow and leaves photo attachment available', async ({
  page,
}) => {
  await page.goto('/chats/1');
  const summary = page.getByRole('button', { name: 'AI 채팅 요약', exact: true });
  await expect(summary).toBeVisible();
  // The label bubble shows only on hover or keyboard focus (user request 2026-11-10); this touch
  // device has no hover, so keyboard focus stands in for it
  const label = summary.locator('xpath=following-sibling::*[1]');
  await expect(label).toHaveText('AI 채팅 요약');
  await expect(label).toBeHidden();
  await summary.focus();
  await expect(label).toBeVisible();
  await summary.blur();
  await expect(label).toBeHidden();
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
  await page.getByLabel('채팅 사진').setInputFiles([await png(page, 400, 300, '#3b82f6')]);
  const photos = page.getByRole('region', { name: '사진 업로드 1장', exact: true });
  await expect(photos).toBeVisible();
  await photos.getByRole('button', { name: '사진 업로드 닫기', exact: true }).click();
  await expect(photos).toBeHidden();
  await expect(input).toHaveValue('작성 중인 메시지');
  await page.goto('/chats/10');
  await expect(page.getByRole('textbox', { name: '메시지' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 채팅 요약', exact: true })).toHaveCount(0);
});

test('17 picked photos lock the input and leave one per message within 220px', async ({ page }) => {
  await page.goto('/chats/1');
  const input = page.getByRole('textbox', { name: '메시지' });
  await input.fill('사진과 같이 가면 안 되는 글');
  const timeline = page.getByRole('region', { name: '대화 내용' });
  const before = await timeline.getByRole('button', { name: /채팅 이미지 \d+ 크게 보기/ }).count();
  const second = timeline.getByRole('button', { name: '채팅 이미지 2 크게 보기' });
  const secondBefore = await second.count();
  await page
    .getByLabel('채팅 사진')
    .setInputFiles([await png(page, 400, 300, '#3b82f6'), await png(page, 150, 400, '#f97316')]);
  await expect(page.getByRole('heading', { name: '사진 업로드 2장', exact: true })).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(input).toHaveAttribute('placeholder', '사진 업로드시 채팅을 칠 수 없습니다');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('heading', { name: /사진 업로드/ })).toHaveCount(0);
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('사진과 같이 가면 안 되는 글');
  const sent = timeline.getByRole('button', { name: /채팅 이미지 \d+ 크게 보기/ });
  await expect(sent).toHaveCount(before + 2);
  // Each photo is its own message, so both are "채팅 이미지 1"
  await expect(second).toHaveCount(secondBefore);
  for (const photo of await sent.locator('img').all()) {
    await expect(photo).toHaveJSProperty('complete', true);
    const box = (await photo.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(220);
    expect(box.height).toBeLessThanOrEqual(220);
  }
});

test('17 immutable PR cards open the existing GitHub confirmation without regular message menus', async ({
  page,
}) => {
  await page.goto('/chats/1');
  await revealPrEvents(page);
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
