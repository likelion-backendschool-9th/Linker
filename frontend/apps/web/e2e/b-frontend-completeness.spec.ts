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

test('setup preserves repo selection and existing board mapping across steps without creating a team', async ({
  page,
}) => {
  await page.goto('/teams/new');
  await page.getByText('연결된 팀으로 선택 화면 미리보기', { exact: true }).click();
  await page.getByLabel('미리보기에 사용할 팀').selectOption('1');
  await page.getByRole('button', { name: '2 팀 정보' }).click();
  await expect(page.getByLabel('팀 이름', { exact: true })).toHaveValue('linker-hack');
  await page.getByRole('button', { name: '3 레포 연결' }).click();
  await page.getByRole('checkbox', { name: 'linker-hack/linker-web', exact: true }).check();
  await page.getByRole('button', { name: '4 보드 연결' }).click();
  await page.getByLabel('기존 보드 쓰기', { exact: true }).check();
  await page.getByRole('combobox', { name: 'Backlog', exact: true }).selectOption('TODO');
  await page.getByRole('button', { name: '5 확인' }).click();
  await expect(page.getByText('로드맵', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '팀 만들기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '4 보드 연결' }).click();
  await expect(page.getByLabel('기존 보드 쓰기', { exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Backlog', exact: true })).toHaveValue('TODO');
  await page.getByRole('button', { name: '3 레포 연결' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'linker-hack/linker-web', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: '5 확인' }).click();
  await page.getByRole('button', { name: '생성 완료 화면 미리보기' }).click();
  await expect(page.getByRole('heading', { name: '팀을 만들었어요' })).toBeVisible();
  await page.getByRole('button', { name: '초대 링크 보내기' }).click();
  await expect(page).toHaveURL('/teams/1/settings');
});

test('callback never trusts installation parameters and all result screens remain explicit previews', async ({
  page,
}) => {
  await page.goto('/teams/new/callback?installation_id=777&setup_action=install&state=forged');
  await expect(
    page.getByRole('heading', { name: '아직 GitHub 연결을 확인할 수 없어요.' }),
  ).toBeVisible();
  await page.getByText('상태별 화면 미리보기', { exact: true }).click();
  const states = [
    ['INSTALLED', 'GitHub 앱 설치를 확인했어요'],
    ['REQUESTED_FROM_OWNER', '오너에게 설치 요청을 보냈어요'],
    ['ALREADY_LINKED', '이미 Linker 팀에 연결된 조직이에요'],
    ['CANCELLED', 'GitHub 앱 설치를 취소했어요'],
    ['INVALID_RETURN', '연결 확인에 필요한 정보가 없거나 일치하지 않아요'],
    ['FAILED', 'GitHub에 연결하지 못했어요.'],
    ['COMPLETE', '팀을 만들었어요'],
  ];
  for (const [value, title] of states) {
    await page.getByLabel('확인할 화면').selectOption(value!);
    await expect(page.getByRole('heading', { name: title!, exact: true })).toBeVisible();
    await expect(
      page.getByText('상태 화면 미리보기예요. 실제 설치·팀 생성·동기화는 실행되지 않았어요.'),
    ).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '초대 링크 보내기' })).toBeDisabled();
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

test('operator refund form validates reasons and never refunds or reveals email', async ({
  page,
}) => {
  await role(page, 'operator');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: /한서준/ }).click();
  await expect(page.getByRole('button', { name: '제재 해제 · 리드 운영자' })).toBeDisabled();
  await page.getByRole('button', { name: '환불 · 결제 1' }).click();
  const sheet = page.getByRole('dialog', { name: '결제를 환불할까요?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '입력 내용 확인' }).click();
  await expect(sheet.getByText('사유를 입력해 주세요', { exact: true })).toBeVisible();
  await expect(sheet.getByLabel('환불 사유 (필수)')).toBeFocused();
  await sheet.getByLabel('환불 사유 (필수)').fill('입력 화면 검토');
  await sheet.getByLabel('대상 결제와 환불 금액을 확인했어요').check();
  await sheet.getByRole('button', { name: '입력 내용 확인' }).click();
  await expect(sheet.getByRole('status')).toContainText('조치는 실행되지 않았어요');
  await expect(sheet.getByRole('button', { name: '환불 실행' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('seojun-han@example.com');
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
    await page.getByRole('button', { name: /한서준/ }).click();
    await page.getByRole('button', { name: '환불 · 결제 1' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate((w) => document.documentElement.scrollWidth <= w, width)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`refund-${width}.png`), fullPage: true });
  }
});
