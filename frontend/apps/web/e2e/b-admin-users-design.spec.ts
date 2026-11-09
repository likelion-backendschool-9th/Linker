import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Admin pages use the desktop shell, not the Android browser project emulation.
test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

async function unlock(page: Page) {
  await page.getByLabel('인증 코드', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '사용자 관리', exact: true })).toBeVisible();
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1568, height: 1004 });
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'operator', url: 'http://localhost:3000' }]);
});
test('26 requires OTP and renders the supplied list/detail design within the unchanged shell', async ({
  page,
}, info) => {
  await page.goto('/admin/users');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('인증 코드', { exact: true }).fill('000000');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('인증 코드가 맞지 않아요');
  await unlock(page);
  await expect(page.getByRole('table', { name: '사용자 목록' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '기본정보' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: '검토', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '제재 해제', exact: true })).toBeDisabled();
  await expect(page.getByRole('navigation', { name: '운영 메뉴' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  for (const width of [1024, 1280, 1568]) {
    await page.setViewportSize({ width, height: 1004 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await capture(page, info, 'users-basic-1568');
});
test('26 status, member type and search filters use URL state and show real empty results', async ({
  page,
}) => {
  await page.goto('/admin/users');
  await unlock(page);
  await page.getByRole('button', { name: '정지', exact: true }).click();
  await expect(page).toHaveURL(/status=SUSPENDED/);
  await expect(page.getByRole('table').getByRole('button', { name: /윤태양/ })).toBeVisible();
  await expect(page.getByRole('table').getByRole('button', { name: /한서준/ })).toHaveCount(0);
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByLabel('계정 유형', { exact: true }).selectOption('RECRUITER');
  await expect(page).toHaveURL(/userType=RECRUITER/);
  await expect(page.getByRole('tab', { name: '기본정보' })).toBeVisible();
  await expect(page.getByText('최근 30일 제안', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '이름, 아이디 검색' }).fill('없는계정확인');
  await expect(page.getByText('조건에 맞는 회원이 없어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
});
test('26 detail tabs include sanctions, reports and the server subscription/payment collections', async ({
  page,
}, info) => {
  await page.goto('/admin/users?user=7');
  await unlock(page);
  await page.getByRole('tab', { name: '제재 이력' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('홍보성 게시물 반복');
  await capture(page, info, 'users-sanctions-1568');
  await page.getByRole('tab', { name: '신고 내역' }).click();
  await expect(page.getByRole('link', { name: '신고 #1', exact: true })).toHaveAttribute(
    'href',
    /\/admin\/reports\?/,
  );
  await capture(page, info, 'users-reports-1568');
  await page.getByRole('tab', { name: '결제 정보' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('PRO');
  await expect(page.getByRole('tabpanel')).toContainText('결제 완료');
  await capture(page, info, 'users-payments-1568');
  await expect(page.getByRole('tab', { name: '결제 정보' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: '환불 · 결제 1' }).click();
  const refund = page.getByRole('dialog', { name: '결제를 환불할까요?' });
  await expect(refund.getByRole('button', { name: '환불 실행' })).toBeDisabled();
  await expect(refund.getByRole('status')).toContainText('현재 환불을 처리할 수 없어요.');
});
test('26 submits a sanction only after confirmation and refreshes the selected history', async ({
  page,
}, info) => {
  await page.goto('/admin/users?user=2');
  await unlock(page);
  await page.getByLabel('조치 유형', { exact: true }).selectOption('WARNING');
  await expect(page.getByRole('button', { name: '조치 적용', exact: true })).toBeDisabled();
  await page.getByLabel('조치 사유 (필수)', { exact: true }).fill('반복 게시물 검토');
  await page.getByRole('button', { name: '조치 적용', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '사용자 제재' });
  await expect(dialog.getByLabel('제재 사유 (필수)')).toHaveValue('반복 게시물 검토');
  await capture(page, info, 'users-sanction-confirm-1568');
  await dialog.getByRole('button', { name: '제재 적용', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('tab', { name: '제재 이력' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('반복 게시물 검토');
});
test('26 reveals email only inside the reason dialog and masks again after closing', async ({
  page,
}, info) => {
  await page.goto('/admin/users?user=1');
  await unlock(page);
  await page.getByRole('button', { name: '사유 입력 후 열람' }).click();
  const dialog = page.getByRole('dialog', { name: '이메일 열람 사유' });
  await dialog.getByRole('button', { name: '사유 기록 후 열람' }).click();
  await expect(dialog.getByLabel('열람 사유 (필수)')).toBeFocused();
  await dialog.getByLabel('열람 사유 (필수)').fill('계정 복구 문의 확인');
  await capture(page, info, 'users-email-reason-1568');
  await dialog.getByRole('button', { name: '사유 기록 후 열람' }).click();
  await expect(dialog.getByRole('status')).toContainText('seojun-han@example.com');
  await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('body')).not.toContainText('seojun-han@example.com');
});
test('26 keeps the narrow detail-to-action overlay path usable', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/admin/users');
  await unlock(page);
  await page.getByRole('button', { name: /한서준/ }).click();
  await expect(page.getByRole('dialog', { name: '회원 상세' })).toBeVisible();
  await page.getByRole('button', { name: '사유 입력 후 열람' }).click();
  await expect(page.getByRole('dialog', { name: '이메일 열람 사유' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
