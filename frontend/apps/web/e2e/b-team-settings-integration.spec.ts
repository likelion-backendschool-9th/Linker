import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3000' }]);
});

test('09 reads live-shaped members and enables the implemented invitation APIs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/teams/1/settings');
  await expect(page.getByRole('heading', { name: '팀원 프로필' })).toBeVisible();
  await expect(page.getByRole('button', { name: '초대 링크 복사', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '팀 초대', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Github 조직 초대', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: / 관리$/ })).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('09 saves installed repo selections and confirms disconnect without deleting GitHub data', async ({
  page,
}) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click();
  await page.getByRole('checkbox', { name: /linker-hack\/infra/ }).check();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'infra 연결 해제', exact: true }).click();
  await expect(page.getByText('GitHub의 레포와 이슈는 삭제되지 않아요.')).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'infra 연결 해제', exact: true })).toHaveCount(0);
});

test('09 requires typed confirmation and leaves member controls disabled for an ordinary member', async ({
  page,
}, info) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '팀 정보 편집', exact: true }).click();
  await expect(page.getByLabel('팀 소개', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '팀 삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '확인', exact: true })).toBeDisabled();
  await page.getByLabel('확인을 위해 팀 이름을 입력해 주세요').fill('Linker 해커톤팀');
  await expect(page.getByRole('button', { name: '확인', exact: true })).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('p09-delete-confirm.png'),
    fullPage: true,
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: info.outputPath('p09-members.png'),
    fullPage: true,
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.goto('/teams/2/settings');
  await expect(page.getByRole('button', { name: / 관리$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '저장소 추가', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /연결 해제$/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: '팀 나가기', exact: true })).toBeEnabled();
});

test('09 copies a newly created invite link and submits the final invitation sheets', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '초대 링크 복사', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/^http:\/\/localhost:3000\/invite\/mock-/);
  await page.getByRole('button', { name: '팀 초대', exact: true }).click();
  await page.getByLabel('GitHub 로그인').fill('@unknown-developer');
  await page.getByRole('button', { name: '초대', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    '초대할 개발자를 찾을 수 없어요',
  );
  await expect(page.getByLabel('GitHub 로그인')).toBeFocused();
  await page.getByLabel('GitHub 로그인').fill('@jiwoo-kang');
  await page.screenshot({
    path: info.outputPath('p09-team-invite.png'),
    fullPage: true,
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.getByRole('button', { name: '초대', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Github 조직 초대', exact: true }).click();
  await page.getByLabel('GitHub 로그인').fill('hayun-jung');
  await page.getByRole('button', { name: '초대', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    '오늘은 GitHub 초대를 더 보낼 수 없어요',
  );
  await page.screenshot({
    path: info.outputPath('p09-github-invite-error.png'),
    fullPage: true,
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
});
