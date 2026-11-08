import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('08 intro keeps the Figma wording, disabled next step and server-issued installation handoff', async ({
  page,
}) => {
  await page.goto('/teams/new');
  await expect(page.getByRole('heading', { level: 1, name: '팀 생성하기' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'GitHub 조직을 연동하고 팀을 만드세요' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('link', { name: 'GitHub 조직 생성하기' })).toHaveAttribute(
    'href',
    'https://github.com/organizations/plan',
  );
  await page.getByRole('button', { name: 'GitHub로 시작하기' }).click();
  await expect(page).toHaveURL(
    /\/teams\/new\/callback\?installation_id=777&setup_action=install&state=mock/,
  );
  await expect(
    page.getByRole('heading', { name: '아직 GitHub 연결을 확인할 수 없어요.' }),
  ).toBeVisible();
});

test('08 back uses the existing workspace fallback', async ({ page }) => {
  await page.goto('/teams/new');
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(page).toHaveURL('/workspace');
});

test('08 intro matches Figma geometry and stays within the mobile column', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/teams/new');
  await expect(page.getByRole('button', { name: 'GitHub로 시작하기' })).toBeEnabled();
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    const header = (await page.getByRole('banner').boundingBox())!;
    expect(header.width).toBe(Math.min(width, 600));
    expect(header.height).toBe(54);
    expect((await page.getByRole('progressbar').boundingBox())?.height).toBe(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 375) {
      const start = (await page.getByRole('button', { name: 'GitHub로 시작하기' }).boundingBox())!;
      const next = (await page.getByRole('button', { name: '다음', exact: true }).boundingBox())!;
      expect(start.y).toBe(660);
      expect(start.height).toBe(43);
      expect(next.y).toBe(723);
      expect(next.height).toBe(53);
    }
    await page.screenshot({
      path: testInfo.outputPath(`team-setup-main-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  expect(errors).toEqual([]);
});
