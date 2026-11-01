import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('PR 29 header trigger opens the shared sheet across C pages and B settings with keyboard focus return', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  for (const route of [
    '/teams/1/issues',
    '/teams/1/issues/1015',
    '/teams/1/issues/new',
    '/teams/1/board',
    '/teams/1/calendar',
    '/teams/1/settings',
  ]) {
    await page.goto(route);
    const trigger = page.getByRole('button', {
      name: /Linker 해커톤팀.*팀 전환/,
      includeHidden: true,
    });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '팀 전환' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: /Linker 해커톤팀.*팀 전환/ }).click();
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
  const trigger = page.getByRole('button', { name: /Linker 해커톤팀.*팀 전환/ });
  await trigger.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Linker 해커톤팀.*현재 팀/ })
    .click();
  await expect(page).toHaveURL('/teams/1/board?status=TODO');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /오픈소스 스터디/ })
    .click();
  await expect(page).toHaveURL('/teams/2/issues');
  await expect(page.getByRole('button', { name: /오픈소스 스터디.*팀 전환/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/teams/1/board?status=TODO');
  await expect(page.getByRole('dialog')).toBeHidden();
});
