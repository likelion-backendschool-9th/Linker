import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function role(page: Page, value: 'developer' | 'operator') {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value, url: 'http://localhost:3000' }]);
}

test.beforeEach(async ({ page }) => {
  await role(page, 'developer');
});

test('completion URL alone never displays a completed team or enables onward navigation', async ({
  page,
}) => {
  await page.goto('/teams/new?step=5');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: '팀을 생성 하셨습니다!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '생성 완료 화면 미리보기' })).toHaveCount(0);
});

test('callback cannot show a simulated completion from preview URL parameters', async ({
  page,
}) => {
  await page.goto('/teams/new/callback?preview=COMPLETE&teamId=1');
  await expect(
    page.getByRole('heading', { name: '연결 확인에 필요한 정보가 없거나 일치하지 않아요' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '팀을 만들었어요' })).toHaveCount(0);
  await expect(page.getByText('상태별 화면 미리보기')).toHaveCount(0);
  await page.getByRole('button', { name: '팀 만들기로 돌아가기' }).click();
  await expect(page).toHaveURL('/teams/new');
});

test('invitations cover every documented participation exception without an accept request', async ({
  page,
}) => {
  const cases = [
    ['demo-member', '이미 함께하는 팀이에요'],
    ['demo-full', '팀 인원이 가득 찼어요'],
    ['demo-limit', '팀은 10개까지 참여할 수 있어요. 보관된 팀은 제외해요.'],
    ['demo-read-only', '읽기 전용 팀에는 참여할 수 없어요.'],
    ['demo-archived', '보관된 팀에는 새로 참여할 수 없어요.'],
    ['demo-accepted', '팀에 참여했어요'],
  ];
  for (const [code, copy] of cases) {
    await page.goto(`/invite/${code}`);
    await expect(page.getByText(copy!, { exact: code !== 'demo-read-only' })).toBeVisible();
    await expect(page.getByRole('button', { name: '팀에 참여하기', exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: '팀 이슈로 가기' })).toHaveAttribute(
    'href',
    '/teams/2/issues',
  );
});

test('settings provide copy fallback, member removal confirmation and board mapping previews', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('unavailable');
        },
      },
    }),
  );
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByLabel('복사할 초대 링크')).toHaveValue(
    'http://localhost:3000/invite/demo-valid',
  );
  await expect(page.getByText('GitHub 조직 초대 중', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '멤버 관리 · 박서연' }).click();
  await page.getByRole('button', { name: '팀에서 내보내기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '팀에서 내보낼까요?' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '팀에서 내보내기', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '보드 변경', exact: true }).click();
  await page.getByLabel('기존 보드 쓰기', { exact: true }).check();
  await expect(page.getByLabel('기존 보드 선택')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Backlog', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '사용 중', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AI 요약 설정' })).toBeVisible();
  await expect(page.getByLabel('AI 요약 사용')).toBeChecked();
});

test('recipient ownership acceptance and finalized completion are separate screens', async ({
  page,
}) => {
  await page.goto('/teams/2/settings');
  await page.getByRole('button', { name: '이전 요청 확인' }).click();
  await expect(page.getByRole('dialog', { name: '소유권 이전을 수락할까요?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '소유권 이전 수락', exact: true })).toBeDisabled();
  await page.goto('/teams/3/settings');
  await page.getByRole('button', { name: '완료 내역 보기' }).click();
  await expect(page.getByText(/완주 기록이 확정됐어요/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '완료 취소', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '다시 시작', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '프로젝트를 다시 시작할까요?' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '다시 시작', exact: true }),
  ).toBeDisabled();
});

test('operator refund remains disabled until a reason can be recorded by the server', async ({
  page,
}) => {
  await role(page, 'operator');
  await page.goto('/admin/users');
  await page.getByLabel('인증 코드', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await page.getByRole('button', { name: /한서준/ }).click();
  await expect(page.getByRole('button', { name: '제재 해제', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: '결제 정보' }).click();
  await page.getByRole('button', { name: '환불 · 결제 1' }).click();
  const sheet = page.getByRole('dialog', { name: '결제를 환불할까요?' });
  await expect(sheet.getByRole('status')).toContainText('현재 환불을 처리할 수 없어요.');
  await expect(sheet.getByRole('button', { name: '환불 실행' })).toBeDisabled();
});

test('stats open a featured selection sheet without changing the profile', async ({ page }) => {
  await page.goto('/me/stats');
  await page.getByRole('button', { name: '대표 작업물로 고정' }).click();
  const sheet = page.getByRole('dialog', { name: '대표 작업물로 고정' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('checkbox').first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('added callback, board and operator refund screens keep the shared responsive design and accessibility', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await role(page, 'developer');
    await page.goto('/teams/new/callback?preview=REQUESTED_FROM_OWNER');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`callback-requested-${width}.png`),
      fullPage: true,
    });
    await page.goto('/teams/1/settings');
    await page.getByRole('button', { name: '보드 변경', exact: true }).click();
    await page.getByLabel('기존 보드 쓰기', { exact: true }).check();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`board-mapping-${width}.png`),
      fullPage: true,
    });
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await role(page, 'operator');
    await page.goto('/admin/users');
    await page.getByLabel('인증 코드', { exact: true }).fill('123456');
    await page.getByRole('button', { name: '인증', exact: true }).click();
    await page.getByRole('button', { name: /한서준/ }).click();
    await page.getByRole('tab', { name: '결제 정보' }).click();
    await page.getByRole('button', { name: '환불 · 결제 1' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`refund-${width}.png`), fullPage: true });
  }
});
