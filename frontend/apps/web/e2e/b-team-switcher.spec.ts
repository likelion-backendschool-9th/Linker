import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
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
