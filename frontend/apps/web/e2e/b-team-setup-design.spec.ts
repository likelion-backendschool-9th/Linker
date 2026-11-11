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

test('08 uses the Figma back/title header while 07 keeps its tab header', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Linker 홈' })).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('link', { name: '설정', exact: true }),
  ).toBeVisible();
  for (const step of [1, 2, 3, 4, 5]) {
    await page.goto(`/teams/new?step=${step}`);
    const header = page.getByRole('banner');
    await expect(header.getByRole('heading', { level: 1, name: '팀 생성하기' })).toBeVisible();
    await expect(header.getByRole('button', { name: '뒤로', exact: true })).toBeVisible();
    await expect(header.getByRole('link')).toHaveCount(0);
    await expect(header.getByRole('button', { name: '검색', exact: true })).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(step));
    expect((await header.boundingBox())?.height).toBe(54);
  }
  await page.getByRole('banner').getByRole('button', { name: '뒤로', exact: true }).click();
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
  await expect(name).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  await expect(description.locator('..')).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  await expect(name).toHaveCSS('color', 'rgb(64, 64, 64)');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toHaveCSS(
    'background-color',
    'rgb(242, 244, 246)',
  );
  await expect(page.getByRole('button', { name: '다음', exact: true })).toHaveCSS(
    'color',
    'rgb(176, 184, 193)',
  );
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
  await page.goBack();
  await expect(page.getByLabel('팀 이름', { exact: true })).toHaveValue('프론트 화면 검토팀');
  await page.getByLabel('팀 이름', { exact: true }).fill('수정한 팀');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/step=3&teamId=\d+/);
  await expect(page.getByRole('checkbox', { name: 'backend', exact: true })).toBeVisible();
});

test('08 callback rejects forged state and returns to installation', async ({ page }) => {
  await page.goto('/teams/new/callback?installation_id=777&setup_action=install&state=forged');
  await expect(page.getByRole('alert').getByText('GitHub에 연결하지 못했어요.')).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('heading', { name: 'GitHub 연결 확인' }),
  ).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('button', { name: '뒤로', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '팀 만들기로 돌아가기' }).click();
  await expect(page).toHaveURL('/teams/new');
});

async function enterRepositories(page: import('@playwright/test').Page) {
  await page.goto('/teams/new');
  await page.getByRole('button', { name: 'GitHub로 시작하기' }).click();
  await expect(page).toHaveURL('/teams/new?step=2');
  await page.getByLabel('팀 소개', { exact: true }).fill('함께 만드는 프로젝트');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/step=3&teamId=\d+/);
  await expect(page.getByRole('checkbox', { name: 'backend', exact: true })).toBeVisible();
}

test('08-3 filters without clearing selection and saves before the board step', async ({
  page,
}) => {
  await enterRepositories(page);
  const next = page.getByRole('button', { name: '다음', exact: true });
  await expect(next).toBeDisabled();
  await page.getByRole('checkbox', { name: 'backend', exact: true }).check();
  await page.getByRole('searchbox', { name: '저장소 검색' }).fill('BOOK');
  await expect(page.getByRole('checkbox', { name: 'frontend', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'bookstore', exact: true }).check();
  await page.getByRole('searchbox', { name: '저장소 검색' }).fill('');
  await expect(page.getByRole('checkbox', { name: 'backend', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'bookstore', exact: true })).toBeChecked();
  await next.click();
  await expect(page).toHaveURL(/step=4&teamId=\d+/);
  await page.goBack();
  await expect(page.getByRole('checkbox', { name: 'backend', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'bookstore', exact: true })).toBeChecked();
});

test('08-3 matches the selected repository frame below the Figma back/title header', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterRepositories(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await expect(page.getByText('화면 미리보기예요.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 375) {
      const search = (await page
        .getByRole('searchbox', { name: '저장소 검색' })
        .locator('..')
        .boundingBox())!;
      expect(search.y).toBe(157);
      expect(search.height).toBe(42);
      const row = (await page.getByRole('checkbox').first().locator('..').boundingBox())!;
      expect(row.y).toBe(219);
      expect(row.height).toBe(40);
      expect((await page.getByRole('button', { name: '다음', exact: true }).boundingBox())?.y).toBe(
        723,
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`team-setup-repositories-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  expect(errors).toEqual([]);
});

async function enterBoards(page: import('@playwright/test').Page) {
  await enterRepositories(page);
  await page.getByRole('checkbox', { name: 'backend', exact: true }).check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/step=4&teamId=\d+/);
  await expect(page.getByRole('radio', { name: 'ShowMoa', exact: true })).toBeVisible();
}

test('08-4 connects the selected board by option ID and retains mapping after browser back', async ({
  page,
}) => {
  await enterBoards(page);
  await page.setViewportSize({ width: 375, height: 800 });
  const next = page.getByRole('button', { name: '다음', exact: true });
  await expect(next).toBeDisabled();
  await page.getByRole('radio', { name: 'ShowMoa', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'ShowMoa', exact: true }).locator('..')).toHaveCSS(
    'color',
    'rgb(17, 24, 39)',
  );
  await expect(page.getByText('ShowMoa · 카드 18개')).toBeVisible();
  await expect(next).toBeDisabled();
  for (const [name, status] of [
    ['Backlog', 'TODO'],
    ['Doing', 'IN_PROGRESS'],
    ['Blocked', 'BLOCKED'],
    ['Done', 'DONE'],
  ]) {
    await page.getByRole('combobox', { name, exact: true }).selectOption(status!);
  }
  await expect(next).toBeEnabled();
  await page.screenshot({
    path: test.info().outputPath('team-setup-board-mapping-375.png'),
    fullPage: true,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await next.click();
  await acknowledgePermission(page);
  await expect(page).toHaveURL(/step=5&teamId=\d+/);
  await expect(page.getByRole('heading', { name: '팀을 생성 하셨습니다!' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('radio', { name: 'ShowMoa', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Backlog', exact: true })).toHaveValue('TODO');
});

test('08-4 matches both board frames below the Figma back/title header at mobile and desktop widths', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterBoards(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByText('화면 미리보기예요.', { exact: false })).toHaveCount(0);
  for (const mode of ['existing', 'new']) {
    await page
      .getByRole('button', {
        name: mode === 'existing' ? '기존 보드 사용' : '새 보드 생성',
        exact: true,
      })
      .click();
    for (const width of [375, 360, 600, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await page.getByRole('banner').boundingBox())?.width).toBe(Math.min(width, 600));
      if (width === 375) {
        const modes = (await page.getByRole('group', { name: '보드 연결 방식' }).boundingBox())!;
        expect(modes.y).toBe(157);
        expect(modes.height).toBe(48);
        expect(
          (await page.getByRole('button', { name: '다음', exact: true }).boundingBox())?.y,
        ).toBe(723);
        if (mode === 'existing') {
          const row = (await page.getByRole('radio').first().locator('..').boundingBox())!;
          expect(row.y).toBe(220);
          expect(row.height).toBe(40);
        } else {
          expect((await page.getByRole('button', { name: '기본 값 사용' }).boundingBox())?.y).toBe(
            220,
          );
          await expect(page.getByRole('button', { name: '저장소 추가' })).toBeDisabled();
          for (const label of ['작업 전', '작업 진행', '작업 완료', '작업 정지'])
            await expect(page.getByRole('button', { name: label + ' 삭제' })).toBeDisabled();
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`team-setup-boards-${mode}-${width}.png`),
        fullPage: true,
        scale: 'css',
        style:
          'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
      });
    }
  }
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await acknowledgePermission(page);
  await expect(page).toHaveURL(/step=5&teamId=\d+/);
  expect(errors).toEqual([]);
});

async function acknowledgePermission(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 375, height: 800 });
  const sheet = page.getByRole('dialog', { name: 'GitHub 권한 설정' });
  await expect(sheet).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('team-setup-permission.png'),
    fullPage: true,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await expect(
    sheet.getByText('팀원이 이슈에 담당자·라벨을 정하려면 쓰기 권한이 필요해요'),
  ).toBeVisible();
  await sheet.getByRole('button', { name: '계속하기' }).click();
  await expect(sheet).toHaveCount(0);
}

test('08-5 matches the final Figma completion and replaces navigation with the created team', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterBoards(page);
  const teamId = new URL(page.url()).searchParams.get('teamId');
  await page.getByRole('button', { name: '새 보드 생성', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await acknowledgePermission(page);
  await expect(page).toHaveURL(/step=5&teamId=\d+/);
  const title = page.getByRole('heading', { name: '팀을 생성 하셨습니다!' });
  await expect(title).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
  await expect(page.getByText('화면 미리보기예요.', { exact: false })).toHaveCount(0);
  for (const width of [375, 360, 600, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => document.fonts.ready);
    const illustration = page.locator('img[src*="high-five"]');
    await expect(illustration).toBeVisible();
    await expect
      .poll(() =>
        illustration.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await page.getByRole('banner').boundingBox())?.width).toBe(Math.min(width, 600));
    if (width === 375) {
      const picture = (await illustration.boundingBox())!;
      expect(picture.y).toBe(239);
      expect(picture.width).toBe(180);
      expect(picture.height).toBe(169);
      expect((await title.boundingBox())?.y).toBe(423);
      expect((await page.getByRole('button', { name: '다음', exact: true }).boundingBox())?.y).toBe(
        723,
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`team-setup-completion-${width}.png`),
      fullPage: true,
      scale: 'css',
      style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
    });
  }
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace(?:\?teamId=\d+)?$/);
  await expect(
    page.getByRole('link', { name: 'my-new-org 팀으로 이동', exact: true }),
  ).toHaveAttribute('href', `/teams/${teamId}/issues`);
  expect(errors).toEqual([]);
});
