import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('team selection is a draft until applied and survives refresh without an overlay history entry', async ({
  page,
}) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: '팀 변경, 현재 Linker 해커톤팀' }).click();
  const sheet = page.getByRole('dialog', { name: '팀 변경' });
  await sheet.getByRole('radio', { name: '오픈소스 스터디' }).check();
  await expect(page.getByRole('heading', { name: '내 Linker 해커톤팀 팀의 이슈', includeHidden: true })).toBeVisible();
  await sheet.getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL('/workspace?teamId=2');
  await expect(page.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues?teamId=2',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: '팀 변경, 현재 오픈소스 스터디' })).toBeVisible();
  await page.getByRole('link', { name: '내 이슈 전체 보기' }).click();
  await expect(page).toHaveURL('/workspace/issues?teamId=2');
  await page.goBack();
  await expect(page).toHaveURL('/workspace?teamId=2');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('selected-team entry, issue creation and team creation retain their existing routes', async ({
  page,
}) => {
  await page.goto('/workspace');
  await expect(page.getByRole('link', { name: 'Linker 해커톤팀 팀으로 이동' })).toHaveAttribute(
    'href',
    '/teams/1/issues',
  );
  await expect(page.getByRole('link', { name: '이슈 작성' })).toHaveAttribute(
    'href',
    '/teams/1/issues/new',
  );
  await expect(page.getByRole('link', { name: '팀 만들기', exact: true })).toHaveAttribute(
    'href',
    '/teams/new',
  );
});

test('main screen keeps Figma geometry and the centered mobile column at each supported width', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/workspace');
  await expect(page.getByRole('article', { name: '졸업작품 TF' })).toBeVisible();
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    const filter = page.getByRole('group', { name: '팀 상태 필터' });
    const box = await filter.boundingBox();
    expect(box?.width).toBe(Math.min(width, 600));
    expect(box?.height).toBe(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toHaveCount(1);
    await page.screenshot({
      path: testInfo.outputPath(`workspace-${width}.png`),
      scale: 'css',
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
