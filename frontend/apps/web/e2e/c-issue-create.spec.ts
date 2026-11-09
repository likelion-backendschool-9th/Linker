import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** C 13 issue create against `pnpm dev:mock` (Figma 200:806, sheets 368:2186…). */
test.describe.configure({ timeout: 90_000 });

const axeOk = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  // color-contrast: Figma values; landmark-unique: shared toaster top+bottom regions
  expect(violations.filter((v) => v.id !== 'color-contrast' && v.id !== 'landmark-unique')).toEqual(
    [],
  );
};

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

async function goStep1(page: Page, teamId = 1) {
  await page.goto(`/teams/${teamId}/issues/new`);
  await expect(page.getByRole('heading', { level: 1, name: '이슈 작성' })).toBeVisible();
}

async function toStep2(page: Page, template = '버그 제보') {
  await goStep1(page);
  await page.getByRole('radio', { name: 'linker-web' }).check({ force: true });
  await page.getByRole('radio', { name: template }).check({ force: true });
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByLabel(/이슈 제목/)).toBeVisible();
}

test('step 1 → step 2 → create → leaves the editor with an issue URL', async ({ page }) => {
  await toStep2(page);
  await page.getByLabel(/이슈 제목/).fill(`e2e 작성 ${Date.now()}`);
  await page.getByRole('button', { name: 'GitHub에 이슈 작성하기' }).click();
  await expect(page.getByText('이슈를 만들었어요.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  // Browser mock writes are not on the server mock store (mock-fetch.ts), so the detail RSC 404s.
  // Assert create finished and navigated with an issue id.
  await expect(page).toHaveURL(/\/teams\/1\/issues\/\d+/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/issues\/new/);
});

test('failed create keeps the draft and "다시 보내기" works', async ({ page }) => {
  await toStep2(page);
  await page.getByLabel(/이슈 제목/).fill('실패 후 재시도');
  await page.getByRole('button', { name: 'GitHub에 이슈 작성하기' }).click();
  await expect(page.getByText('GitHub에 연결하지 못했어요')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '다시 보내기' }).click();
  await expect(page.getByText('이슈를 만들었어요.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/teams\/1\/issues\/\d+/, { timeout: 30_000 });
});
test('restores a device draft', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'draft:issue:team-1',
      JSON.stringify({
        value: {
          repoId: 11,
          templateKey: 'repo:bug',
          title: '복구된 제목',
          body: '## 현상\n복구 본문',
          answers: {},
          assigneeIds: null,
          labels: null,
          startDate: null,
          dueDate: null,
          status: 'TODO',
        },
        savedAt: Date.now(),
      }),
    );
  });
  await page.goto('/teams/1/issues/new');
  const sheet = page.getByRole('dialog', { name: '작성하던 내용이 있어요' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '이어 쓰기' }).click();
  await expect(page.getByLabel(/이슈 제목/)).toHaveValue('복구된 제목');
});

test('hides repos without write permission', async ({ page }) => {
  await goStep1(page, 2);
  await expect(page.getByRole('radio')).toHaveCount(0);
});

test('an 이슈 양식 row opens its sheet', async ({ page }) => {
  await toStep2(page);
  await page.getByRole('button', { name: /^상태/ }).click();
  const sheet = page.getByRole('dialog', { name: '이슈 상태' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '완료' }).click();
  await expect(sheet).toHaveCount(0);
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without page sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    await toStep2(page);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await axeOk(page);
  });
}
