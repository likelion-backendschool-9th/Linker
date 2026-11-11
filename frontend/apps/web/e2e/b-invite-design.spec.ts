import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

for (const [code, message] of [
  ['demo-expired-member', '초대 링크의 유효 기간이 지났어요.'],
  ['demo-revoked-member', '더 이상 쓸 수 없는 초대 링크예요.'],
] as const) {
  test(`10 keeps ${code} on the slim landing and explains rejection`, async ({ page }, info) => {
    await page.goto(`/invite/${code}`);
    await expect(page.getByRole('heading', { name: 'linker', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '팀에 합류 하기' }).click();
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(`/invite/${code}`);
    await page.screenshot({
      path: info.outputPath(`${code}.png`),
      animations: 'disabled',
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  });
}

test('10 developer acceptance navigates to the joined team', async ({ page }) => {
  await page.goto('/invite/demo-valid');
  await page.getByRole('button', { name: '팀에 합류 하기' }).click();
  await expect(page).toHaveURL('/teams/2/issues');
});

test('10 guest login returns to the invite without automatically accepting it', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'guest', url: 'http://localhost:3000' }]);
  await page.goto('/invite/demo-valid');
  await page.getByRole('button', { name: 'GitHub로 빠르게 시작하기' }).click();
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((c) => c.name === 'linker_mock_role')?.value,
    )
    .toBe('developer');
  await expect(page).toHaveURL('/invite/demo-valid');
  await expect(page.getByRole('button', { name: '팀에 합류 하기' })).toBeVisible();
});

test('10 recruiter cannot accept or start developer login', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'recruiter', url: 'http://localhost:3000' }]);
  await page.goto('/invite/demo-valid');
  await page.getByRole('button', { name: '팀에 합류 하기' }).click();
  await expect(
    page.getByText('개발자 계정만 팀에 참여할 수 있어요', { exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL('/invite/demo-valid');
});
