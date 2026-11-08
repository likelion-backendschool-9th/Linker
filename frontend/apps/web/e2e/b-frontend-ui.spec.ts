import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const origin = 'http://localhost:3000';

async function role(page: Page, value: 'guest' | 'developer' | 'recruiter' | 'operator') {
  await page.context().addCookies([{ name: 'linker_mock_role', value, url: origin }]);
}

test.beforeEach(async ({ page }) => {
  await role(page, 'developer');
});

test('workspace filters teams and reuses the team switcher without a navigation trap', async ({
  page,
}) => {
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: '내 팀' })).toBeVisible();
  await page.getByRole('button', { name: '완료 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '졸업작품 TF' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Linker 해커톤팀', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^전체/ }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await page.getByRole('article', { name: 'Linker 해커톤팀' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/teams\/1\/issues$/);
  await page.getByRole('button', { name: /Linker 해커톤팀.*팀 변경/ }).click();
  await expect(page.getByRole('dialog', { name: '팀 변경' })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/\/workspace/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('team setup previews local fields and never offers a live installation or team submission', async ({
  page,
}) => {
  await page.goto('/teams/new');
  await expect(page.getByRole('button', { name: 'GitHub에서 설치하기' })).toBeDisabled();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/step=2/);
  await page.getByLabel('팀 이름', { exact: true }).fill('프론트 화면 검토팀');
  await page.getByLabel('팀 소개', { exact: true }).fill('팀원과 같은 디자인으로 만들어요.');
  await page.getByRole('button', { name: '5 확인' }).click();
  await expect(page.getByText('프론트 화면 검토팀', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '팀 만들기', exact: true })).toBeDisabled();
  await expect(page.getByText('아직 연결하지 않았어요', { exact: true })).toBeVisible();
});

test('settings expose preview sheets and keep member permissions separate', async ({ page }) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '편집', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '팀 정보 편집' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.goto('/teams/2/settings');
  await expect(page.getByRole('button', { name: '편집', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '소유권 이전', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '팀 나가기', exact: true })).toBeVisible();
});

test('public invitation uses login prompts and recruiter guidance', async ({ page }) => {
  await role(page, 'guest');
  await page.goto('/invite/demo-valid');
  await page.getByRole('button', { name: 'GitHub로 시작하고 참여하기' }).click();
  await expect(
    page.getByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' }),
  ).toBeVisible();
  await role(page, 'recruiter');
  await page.goto('/invite/demo-valid');
  await expect(page.getByText('개발자 계정만 팀에 참여할 수 있어요')).toBeVisible();
  await page.goto('/invite/demo-expired');
  await expect(page.getByText('초대 링크의 유효 기간이 지났어요.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('mobile operator detail can switch to the reason form without losing its overlay', async ({
  page,
}) => {
  await role(page, 'operator');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: /한서준/ }).click();
  await expect(page.getByRole('dialog', { name: '회원 상세' })).toBeVisible();
  await page.getByRole('button', { name: '이메일 전체 보기' }).click();
  const sheet = page.getByRole('dialog', { name: '이메일 열람 사유' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('열람 사유 (필수)').fill('화면 입력 확인');
  await expect(sheet.getByRole('button', { name: '사유 기록 후 열람' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('seojun.han@example.com');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('audit dates validate and statistics expose accessible data tables', async ({ page }) => {
  await role(page, 'operator');
  await page.goto('/admin/audit');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('시작일 (KST)').fill('2026-11-02');
  await page.getByLabel('종료일 (KST)').fill('2026-11-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('종료일은 시작일 이후로');
  await role(page, 'developer');
  await page.goto('/me/stats');
  await expect(page.getByRole('heading', { name: '채용 담당자 조회' })).toBeVisible();
  await page.getByText('표로 보기', { exact: true }).first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('PR sheet is team-only and the system event offers no editing action', async ({ page }) => {
  await page.goto('/chats/1');
  await page.getByRole('button', { name: 'PR 목록' }).click();
  const sheet = page.getByRole('dialog', { name: 'Pull requests' });
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: '병합됨', exact: true }).click();
  await expect(sheet.getByText('chore: eslint 규칙 정리', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /수정|삭제/ })).toHaveCount(0);
});

test('B screens retain landmarks, accessibility, and mobile-to-desktop layout', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const routes = [
    '/workspace',
    '/teams/new',
    '/teams/1/settings',
    '/invite/demo-valid',
    '/me/stats',
    '/admin/users',
    '/admin/audit',
  ];
  for (const route of routes) {
    await role(page, route.startsWith('/admin') ? 'operator' : 'developer');
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    const violations = await new AxeBuilder({ page }).analyze();
    expect(violations.violations, route).toEqual([]);
    for (const width of [360, 600, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          (viewportWidth) => document.documentElement.scrollWidth <= viewportWidth,
          width,
        ),
        `${route} @ ${width}`,
      ).toBe(true);
      if (width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(`${route.replaceAll('/', '-')}-desktop.png`),
          fullPage: true,
          scale: 'css',
        });
    }
    await page.setViewportSize({ width: 360, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath(`${route.replaceAll('/', '-')}-mobile.png`),
      fullPage: true,
      scale: 'css',
    });
  }
  await page.goto('/teams/1/issues');
  await expect(page.getByRole('navigation', { name: '팀 메뉴' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('existing-issues-reference.png'),
    fullPage: true,
    scale: 'css',
  });
});
