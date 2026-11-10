import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
  await page.setViewportSize({ width: 375, height: 800 });
});
async function openList(page: Page, room = 1) {
  await page.goto(`/chats/${room}`);
  await page.getByRole('button', { name: '채팅방 정보' }).click();
  await page.getByRole('button', { name: 'PR 보러 가기', exact: true }).click();
  return page.getByRole('dialog', { name: 'PR 목록', exact: true });
}
test('17 PR list matches the selected full-screen Figma and stays within the app column', async ({
  page,
}, info) => {
  const dialog = await openList(page);
  await expect(dialog.getByText('열린 PR 3개', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio')).toHaveCount(3);
  await expect(dialog.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '팀에 공유 하기' })).toBeDisabled();
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBe(Math.min(width, 600));
    expect(box.height).toBe(800);
    expect(box.x).toBe((width - Math.min(width, 600)) / 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 375) {
      const header = (await dialog.getByRole('banner').boundingBox())!;
      expect(header.height).toBe(54);
      const tabs = (await dialog.getByRole('group', { name: 'PR 상태' }).boundingBox())!;
      expect(tabs.y).toBe(54);
      expect(tabs.height).toBe(42);
      const count = (await dialog.getByText('열린 PR 3개', { exact: true }).boundingBox())!;
      expect(count.x).toBe(16);
      expect(count.y).toBe(121);
      const card = (await dialog.getByRole('article').first().boundingBox())!;
      expect(card.x).toBe(16);
      expect(card.y).toBe(165);
      expect(card.width).toBe(343);
      expect(card.height).toBe(174);
      const github = (await dialog
        .getByRole('button', { name: /GitHub에서 열기/ })
        .first()
        .boundingBox())!;
      expect(github.y).toBe(280);
      expect(github.height).toBe(44);
      const share = (await dialog.getByRole('button', { name: '팀에 공유 하기' }).boundingBox())!;
      expect(share.y).toBe(723);
      expect(share.height).toBe(53);
    }
    await page.screenshot({
      path: info.outputPath(`pr-list-open-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  // Preserve the designer's AA-low-contrast meta color; verify semantics separately.
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag21a'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test('17 changes tabs without retaining the other list selection and shows GitHub update times', async ({
  page,
}, info) => {
  const dialog = await openList(page);
  await dialog.getByText('#29 fix: 피드 스켈레톤 높이', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: /#29/ })).toBeChecked();
  await expect(page).toHaveURL(/selectedPr=29/);
  await expect(dialog.locator('time').first()).toHaveAttribute('datetime', /\+09:00$/);
  await expect(dialog.locator('time').first()).toHaveText('2시간 전');
  await dialog.getByRole('button', { name: '병합 된 PR', exact: true }).click();
  await expect(dialog.getByText('병합 된 PR 1개', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/pr=merged/);
  expect(new URL(page.url()).searchParams.has('selectedPr')).toBe(false);
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await expect(dialog.getByRole('radio')).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: '팀에 공유 하기' })).toBeDisabled();
  await expect(dialog.getByText('담당자 이도윤님이')).toBeVisible();
  await expect(dialog.getByText('PR 병합', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('pr-list-merged-375.png'),
    fullPage: true,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
});
test('17 shares the selected PR link through the existing chat sender and then returns to chat', async ({
  page,
}, info) => {
  const dialog = await openList(page);
  await dialog.getByText('#29 fix: 피드 스켈레톤 높이', { exact: true }).click();
  await expect(dialog.getByRole('button', { name: '팀에 공유 하기' })).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('pr-list-selected-qa-375.png'),
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await dialog.getByRole('button', { name: '팀에 공유 하기' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByRole('region', { name: '대화 내용' })
      .getByText('https://github.com/linker-hack/linker-web/pull/29', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('보내지 못했어요.', { exact: true })).toHaveCount(0);
});
test('17 GitHub links reuse the external confirmation sheet and back closes the PR screen', async ({
  page,
}) => {
  let dialog = await openList(page);
  await dialog
    .getByRole('button', { name: /GitHub에서 열기/ })
    .first()
    .click();
  const external = page.getByRole('dialog', { name: '외부 사이트로 이동합니다' });
  await expect(external).toBeVisible();
  await expect(
    external.getByText('github.com(으)로 이동해요. 새 창에서 열려요.', { exact: true }),
  ).toBeVisible();
  await external.getByRole('button', { name: '취소', exact: true }).click();
  await expect(external).toBeHidden();
  dialog = await openList(page);
  await dialog.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/chats/1');
});
test('17 never exposes PR lists in direct chats', async ({ page }) => {
  await page.goto('/chats/10');
  await page.getByRole('button', { name: '채팅방 정보' }).click();
  await expect(page.getByRole('button', { name: 'PR 보러 가기', exact: true })).toHaveCount(0);
});
