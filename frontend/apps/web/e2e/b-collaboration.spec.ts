import { expect, test, type Page } from '@playwright/test';

async function role(page: Page, value: 'developer' | 'operator') {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value, url: 'http://localhost:3000' }]);
}
test.beforeEach(async ({ page }) => {
  await role(page, 'developer');
});

test('workspace preserves C full-list navigation with the Figma more control', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues',
  );
  await expect(page.getByRole('link', { name: '내 통계', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '내 이슈 전체 보기' }).click();
  await expect(page).toHaveURL('/workspace/issues');
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(page).toHaveURL('/workspace');
});

test('team and statistics subscription entry preserves its same-app return destination', async ({
  page,
}) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('link', { name: '구독 관리', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/subscription\?returnTo=/);
  await expect(page.getByRole('heading', { level: 1, name: '구독 관리' })).toBeVisible();
  // A fresh tab verifies the explicit fallback, without relying on prior app history.
  const direct = await page.context().newPage();
  await direct.goto('/subscribe?teamId=1&reason=team-members&returnTo=%2Fteams%2F1%2Fsettings');
  await expect(direct.getByRole('combobox', { name: '결제할 팀' })).toHaveValue('1');
  await direct.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(direct).toHaveURL('/teams/1/settings');
  await direct.close();
});

test('untrusted subscription return paths fall back to the feed', async ({ page }) => {
  await page.goto('/subscribe?returnTo=https%3A%2F%2Fexample.com');
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(page).toHaveURL('/feed');
});

test('completed teams hand off to E and member profiles hand off to A with documented URLs', async ({
  page,
}) => {
  await page.goto('/teams/3/settings');
  await expect(page.getByRole('link', { name: '작업물 올리기' })).toHaveAttribute(
    'href',
    '/posts/new?teamId=3',
  );
  await expect(page.getByRole('link', { name: '한서준 프로필 보기' })).toHaveAttribute(
    'href',
    '/user/seojun-han',
  );
});

test('completing a team keeps the existing D chat composer available without sending a message', async ({
  page,
}) => {
  await page.goto('/teams/3/settings');
  await page.getByRole('link', { name: '팀 채팅으로 가기' }).click();
  await expect(page).toHaveURL('/chats/3');
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByText('지금은 대화를 읽을 수만 있어요.')).toHaveCount(0);
});

test('profile handoff closes the stats sheet before navigation and back does not reopen it', async ({
  page,
}) => {
  await page.goto('/me/stats');
  await page.getByRole('button', { name: '대표 작업물로 고정' }).click();
  const link = page.getByRole('link', { name: '내 프로필에서 확인' });
  await expect(link).toHaveAttribute('href', '/user/seojun-han');
  await link.click();
  // This checks the URL/history handoff; profile page contents are owned by A.
  await expect(page).toHaveURL('/user/seojun-han');
  await page.goBack();
  await expect(page).toHaveURL('/me/stats');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('admin reports handoff uses only A supported list filters and closes mobile detail history', async ({
  page,
}) => {
  await role(page, 'operator');
  await page.goto('/admin/users');
  await page.getByRole('textbox', { name: '인증 코드', exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증하고 신고 보기', exact: true }).click();
  await page.getByRole('button', { name: /한서준/ }).click();
  const link = page.getByRole('link', { name: '처리된 신고 목록 보기' });
  await expect(link).toHaveAttribute('href', '/admin/reports?tab=reports&status=HANDLED');
  await link.click();
  await expect(page).toHaveURL('/admin/reports?tab=reports&status=HANDLED');
  await page.goBack();
  await expect(page).toHaveURL('/admin/users');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('B workspace and real PR 35 list connect through issue detail and back', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('link', { name: '내 이슈 전체 보기' }).click();
  await expect(page).toHaveURL('/workspace/issues');
  await expect(page.getByRole('heading', { level: 1, name: '내 이슈' })).toBeVisible();
  const issue = page.getByRole('article').locator('a[href^="/teams/"][href*="/issues/"]').first();
  await issue.click();
  await expect(page).toHaveURL(/\/teams\/\d+\/issues\/\d+$/);
  await page.goBack();
  await expect(page).toHaveURL('/workspace/issues');
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(page).toHaveURL('/workspace');
});

test('D mock refund removes B Pro stats on entry and after a full reload', async ({ page }) => {
  await page.goto('/me/stats');
  await expect(page.getByRole('heading', { name: '채용 담당자 조회', exact: true })).toBeVisible();

  await page.goto('/settings/subscription');
  await page.getByRole('button', { name: '환불하기 · Pro 월간', exact: true }).click();
  await page
    .getByRole('dialog', { name: '전액 환불할까요?' })
    .getByRole('button', { name: '전액 환불하기', exact: true })
    .click();
  await expect(page.getByText('환불 완료', { exact: false })).toBeVisible();

  await page.goto('/me/stats');
  await expect(page.getByRole('link', { name: 'Pro로 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '채용 담당자 조회', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Pro로 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '채용 담당자 조회', exact: true })).toHaveCount(0);
});
