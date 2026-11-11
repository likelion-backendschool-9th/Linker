import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('settings top-right icon opens team change and applies the existing navigation flow', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/teams/1/settings');
  const header = page.getByRole('banner');
  const trigger = header.getByRole('button', { name: '팀 변경', exact: true });
  await expect(header.getByRole('button', { name: '팀 설정', exact: true })).toHaveCount(0);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: '팀 변경', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Linker 해커톤팀' })).toBeChecked();
  await expect(page.getByRole('dialog', { name: '팀 설정', exact: true })).toHaveCount(0);
  await expect(sheet.getByRole('heading', { name: '팀 플랜' })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('settings-header-team-switcher.png'),
    fullPage: false,
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await sheet.getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL('/teams/1/settings');
  await trigger.click();
  await sheet.getByRole('radio', { name: '오픈소스 스터디' }).check();
  await sheet.getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(page).toHaveURL('/teams/2/issues');
  await page.goBack();
  await expect(page).toHaveURL('/teams/1/settings');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('team header opens the shared sheet with keyboard focus return', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Final 12/13 designs have dedicated detail/write headers, not the team header.
  for (const route of [
    '/teams/1/issues',
    '/teams/1/board',
    '/teams/1/calendar',
    '/teams/1/settings',
  ]) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', {
      name: /Linker 해커톤팀.*팀 변경/,
      includeHidden: true,
    });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await expect(page.getByRole('dialog', { name: '팀 변경' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ }).click();
    await expect(page.getByRole('dialog', { name: '팀 변경' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`team-switcher-${width}.png`),
      fullPage: true,
      scale: 'css',
    });
    await page.keyboard.press('Escape');
  }
});

test('current-team selection retains the board URL while another-team selection removes sheet history', async ({
  page,
}) => {
  await page.goto('/teams/1/board?status=TODO');
  const trigger = page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ });
  await trigger.click();
  // Figma "팀 변경" sheet: the current team is checked; the button applies the choice
  await expect(
    page.getByRole('dialog').getByRole('radio', { name: 'Linker 해커톤팀' }),
  ).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(page).toHaveURL('/teams/1/board?status=TODO');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('dialog').getByRole('radio', { name: '오픈소스 스터디' }).check();
  await page.getByRole('dialog').getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(page).toHaveURL('/teams/2/issues');
  await expect(page.getByRole('button', { name: /오픈소스 스터디.*팀 변경/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/teams/1/board?status=TODO');
  await expect(page.getByRole('dialog')).toBeHidden();
});
