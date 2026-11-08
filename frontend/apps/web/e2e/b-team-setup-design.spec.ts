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
  await expect(page).toHaveURL('/teams/new?step=2');
  await expect(page.getByRole('heading', { name: '팀 정보를 입력해 주세요' })).toBeVisible();
  await expect(page.getByLabel('팀 이름', { exact: true })).toHaveValue('my-new-org');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
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

test('08-2 matches the selected form and keeps unverified URL fields from enabling next', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/teams/new?step=2&installation_id=777&org=Dawn-Guys');
  await page.getByLabel('팀 이름', { exact: true }).fill('새 프로젝트');
  await page.getByLabel('팀 소개', { exact: true }).fill('팀 소개');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: /Dawn/ })).toHaveCount(0);
  await page.goto('/teams/new');
  await page.getByRole('button', { name: 'GitHub로 시작하기' }).click();
  await expect(page).toHaveURL('/teams/new?step=2');
  const name = page.getByLabel('팀 이름', { exact: true });
  const description = page.getByLabel('팀 소개', { exact: true });
  await name.fill('');
  await page.getByRole('heading', { name: '팀 정보를 입력해 주세요' }).click();
  await expect(name).toHaveAttribute('maxlength', '50');
  await expect(description).toHaveAttribute('maxlength', '100');
  await expect(page.getByText('0/100', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByText('화면 미리보기예요.', { exact: false })).toHaveCount(0);
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 375) {
      expect((await name.boundingBox())?.y).toBe(308);
      expect((await description.locator('..').boundingBox())?.height).toBe(100);
      expect((await page.getByRole('button', { name: '다음', exact: true }).boundingBox())?.y).toBe(
        723,
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`team-setup-information-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  await name.fill('프론트 화면 검토팀');
  await description.fill('팀원과 같은 디자인으로 만들어요.');
  await expect(page.getByText('18/100', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/step=3/);
  await page.getByRole('button', { name: '5 확인' }).click();
  await expect(page.getByText('프론트 화면 검토팀', { exact: true })).toBeVisible();
});

test('08 callback rejects forged state and returns to installation', async ({ page }) => {
  await page.goto('/teams/new/callback?installation_id=777&setup_action=install&state=forged');
  await expect(page.getByRole('alert').getByText('GitHub에 연결하지 못했어요.')).toBeVisible();
  await page.getByRole('button', { name: '팀 만들기로 돌아가기' }).click();
  await expect(page).toHaveURL('/teams/new');
});
