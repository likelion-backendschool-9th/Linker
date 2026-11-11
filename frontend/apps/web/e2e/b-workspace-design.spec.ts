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
  await expect(
    page.getByRole('heading', { name: '내 Linker 해커톤팀 팀의 이슈', includeHidden: true }),
  ).toBeVisible();
  await sheet.getByRole('button', { name: '팀 변경', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL('/workspace?teamId=2');
  await expect(page.getByRole('link', { name: /내 이슈 전체 보기/ })).toHaveAttribute(
    'href',
    '/workspace/issues?teamId=2',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: '팀 변경, 현재 오픈소스 스터디' })).toBeVisible();
  await page.getByRole('link', { name: /내 이슈 전체 보기/ }).click();
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
  await expect(page.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveText('더 보기');
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
      // Hide development-only diagnostics, never application content.
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  expect(errors).toEqual([]);
});

test('07 sheet matches its 293px frame and cancellation restores focus without applying the draft', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/workspace');
  const trigger = page.getByRole('button', { name: '팀 변경, 현재 Linker 해커톤팀' });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: '팀 변경' });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(507);
  const box = (await sheet.boundingBox())!;
  expect(box.width).toBe(375);
  expect(box.height).toBeCloseTo(293, 1);
  const choices = sheet.getByRole('radio');
  await expect(choices).toHaveCount(3);
  expect((await choices.first().locator('..').boundingBox())?.height).toBeCloseTo(40, 1);
  expect(
    (await sheet.getByRole('button', { name: '팀 변경', exact: true }).boundingBox())?.height,
  ).toBeCloseTo(53, 1);
  await page.screenshot({
    path: testInfo.outputPath('workspace-team-sheet-375.png'),
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await sheet.getByRole('radio', { name: '오픈소스 스터디' }).check();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL('/workspace');
  await trigger.click();
  await expect(sheet.getByRole('radio', { name: 'Linker 해커톤팀' })).toBeChecked();
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('direct-link and browser-back sheet closing never adds a new history entry', async ({
  page,
}) => {
  await page.goto('/feed');
  await page.goto('/workspace?overlay=my-issues-team');
  const sheet = page.getByRole('dialog', { name: '팀 변경' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL('/workspace');
  await page.goBack();
  await expect(page).toHaveURL('/feed');
  await page.goto('/workspace');
  await page.getByRole('button', { name: '팀 변경, 현재 Linker 해커톤팀' }).click();
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL('/workspace');
});

test('07 reuses the shared header and signed-in five-tab menu used by other pages', async ({
  page,
}) => {
  await page.goto('/workspace');
  await page.waitForLoadState('networkidle');
  const menu = page.getByRole('navigation', { name: '주 메뉴' });
  await expect(menu.getByRole('link')).toHaveCount(5);
  await expect(menu.getByRole('link', { name: '프로필' })).toHaveAttribute(
    'href',
    '/user/seojun-han',
  );
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings');
  await expect(header.getByRole('link', { name: '내 프로필' })).toHaveCount(0);
  await expect(header.getByRole('img', { name: 'Linker', exact: true })).toHaveAttribute(
    'src',
    '/textlogo.svg',
  );
  const headerStyles = await header.evaluate((node) => ({
    className: node.className,
    height: node.getBoundingClientRect().height,
    iconTargets: Array.from(node.querySelectorAll('button, a')).map(
      (item) => item.getAttribute('aria-label') ?? item.textContent?.trim(),
    ),
  }));
  expect(headerStyles.height).toBe(56);
  await expect(header.getByRole('button', { name: '검색', exact: true })).toHaveCount(0);
  for (const path of ['/feed', '/recruits']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link')).toHaveCount(
      5,
    );
    await expect(page.getByRole('banner').getByRole('link', { name: '설정' })).toBeVisible();
    expect(
      await page.getByRole('banner').evaluate((node) => ({
        className: node.className,
        height: node.getBoundingClientRect().height,
        iconTargets: Array.from(node.querySelectorAll('button, a')).map(
          (item) => item.getAttribute('aria-label') ?? item.textContent?.trim(),
        ),
      })),
    ).toEqual(headerStyles);
  }
});
