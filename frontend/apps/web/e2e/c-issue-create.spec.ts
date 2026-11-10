import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** C 13 issue create against `pnpm dev:mock` (Figma 200:806 one page). */
test.describe.configure({ timeout: 90_000 });

const axeOk = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.id !== 'color-contrast' && v.id !== 'landmark-unique')).toEqual(
    [],
  );
};

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

async function openCreate(page: Page, teamId = 1) {
  await page.goto(`/teams/${teamId}/issues/new`);
  await expect(page.getByRole('heading', { level: 1, name: '이슈 작성' })).toBeVisible();
}

async function pickRepoAndTemplate(page: Page, template = '버그 제보') {
  await openCreate(page);
  // Legend + sr-only "(필수)" → name like "저장소 선택 (필수)"
  await page.getByRole('button', { name: /저장소 선택/ }).click();
  const repoSheet = page.getByRole('dialog', { name: '저장소 변경' });
  await expect(repoSheet).toBeVisible();
  await repoSheet.locator('label').filter({ hasText: 'linker-web' }).click();
  await repoSheet.getByRole('button', { name: '변경' }).click();
  await expect(repoSheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: /linker-web/ })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /이슈 템플릿/ }).click();
  const tplSheet = page.getByRole('dialog', { name: '템플릿 선택' });
  await expect(tplSheet).toBeVisible();
  await tplSheet.locator('label').filter({ hasText: template }).click();
  await tplSheet.getByRole('button', { name: '변경' }).click();
  await expect(tplSheet).toHaveCount(0);
  await expect(page.getByLabel(/이슈 제목/)).toBeVisible();
}

test('pick repo + template → create → detail shows title (not unavailable)', async ({ page }) => {
  await pickRepoAndTemplate(page);
  const title = `e2e 작성 ${Date.now()}`;
  await page.getByLabel(/이슈 제목/).fill(title);
  await page.getByRole('button', { name: 'GitHub에 이슈 작성하기' }).click();
  await expect(page.getByText('이슈를 만들었어요.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/teams\/1\/issues\/\d+/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/issues\/new/);
  await expect(page.getByText('볼 수 없는 콘텐츠')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});

test('요청 (이슈 폼) uses markdown body UI like bug templates', async ({ page }) => {
  await pickRepoAndTemplate(page, '요청 (이슈 폼)');
  await expect(page.getByLabel(/이슈 제목/)).toHaveValue('[요청] ');
  await expect(page.getByRole('button', { name: '마크다운 입력' })).toBeVisible();
  await expect(page.getByRole('button', { name: '미리보기' })).toBeVisible();
  const body = page.getByRole('textbox', { name: /이슈 본문/ });
  await expect(body).toBeVisible();
  await expect(body).toHaveValue(/## 요약[\s\S]*## 자세한 내용[\s\S]*## 확인 사항/);
  await expect(page.getByText(/0\/2000|\/2000/)).toBeVisible();
  await expect(page.getByLabel(/^요약/)).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('failed create keeps the draft and "다시 보내기" works', async ({ page }) => {
  await pickRepoAndTemplate(page);
  await page.getByLabel(/이슈 제목/).fill('실패 후 재시도');
  await page.getByRole('button', { name: 'GitHub에 이슈 작성하기' }).click();
  await expect(page.getByText('GitHub에 연결하지 못했어요')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '다시 보내기' }).click();
  await expect(page.getByText('이슈를 만들었어요.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/teams\/1\/issues\/\d+/, { timeout: 30_000 });
});

test('restores a device draft via the modal', async ({ page }) => {
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
  const modal = page.getByRole('dialog', { name: '이어 쓰기' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '이어쓰기' }).click();
  await expect(page.getByLabel(/이슈 제목/)).toHaveValue('복구된 제목', { timeout: 10_000 });
});

test('hides writable repos for a team without write access', async ({ page }) => {
  await openCreate(page, 2);
  await page.getByRole('button', { name: /저장소 선택/ }).click();
  const repoSheet = page.getByRole('dialog', { name: '저장소 변경' });
  await expect(repoSheet.getByText('쓸 수 있는 저장소가 없어요.')).toBeVisible();
});

test('an 이슈 양식 row opens its sheet', async ({ page }) => {
  await pickRepoAndTemplate(page);
  await page.getByRole('button', { name: /^상태/ }).click();
  const sheet = page.getByRole('dialog', { name: '이슈 상태' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '완료' }).click();
  await expect(sheet).toHaveCount(0);
});

test('assignee sheet shows job role and selects without a left radio', async ({ page }) => {
  await pickRepoAndTemplate(page);
  await page.getByRole('button', { name: /^담당자/ }).click();
  const sheet = page.getByRole('dialog', { name: '이슈 담당자' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('PO')).toBeVisible();
  await expect(sheet.locator('[class*="radioMark"]')).toHaveCount(0);
  await sheet.locator('label').filter({ hasText: '한서준' }).click();
  await expect(sheet.getByRole('checkbox', { name: /한서준/ })).toBeChecked();
  await sheet.getByRole('button', { name: '완료' }).click();
});

for (const width of [360, 375, 600]) {
  test(`fits ${width}px without page sideways scroll; axe finds only the Figma contrast exceptions`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    await pickRepoAndTemplate(page);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await axeOk(page);
  });
}
