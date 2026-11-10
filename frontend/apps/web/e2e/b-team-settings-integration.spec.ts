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
  await page.getByRole('button', { name: '팀 설정', exact: true }).click();
  await page.getByRole('button', { name: '팀 정보 편집', exact: true }).click();
  await expect(page.getByLabel('팀 소개', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '팀 삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '삭제하기', exact: true })).toBeDisabled();
  await page.getByLabel('확인을 위해 팀 이름을 입력해 주세요').fill('Linker 해커톤팀');
  await expect(page.getByRole('button', { name: '삭제하기', exact: true })).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('p09-delete-confirm.png'),
    fullPage: false,
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: info.outputPath('p09-members.png'),
    fullPage: false,
    scale: 'css',
    animations: 'disabled',
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
  await expect(page.getByText('초대 링크를 복사했어요.', { exact: true })).toBeHidden({
    timeout: 7000,
  });
  await page.screenshot({
    path: info.outputPath('p09-team-invite.png'),
    fullPage: false,
    scale: 'css',
    animations: 'disabled',
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
  await expect(page.getByText('팀 초대를 보냈어요.', { exact: true })).toBeHidden({
    timeout: 7000,
  });
  await page.screenshot({
    path: info.outputPath('p09-github-invite-error.png'),
    fullPage: false,
    scale: 'css',
    animations: 'disabled',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
});

test('09 deletes only after exact name confirmation and returns to workspace', async ({
  page,
}, info) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button', { name: '팀 삭제', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: '팀 삭제' });
  const confirm = dialog.getByRole('button', { name: '삭제하기', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('확인을 위해 팀 이름을 입력해 주세요').fill('Linker 해커톤팀');
  await expect(confirm).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('p09-delete-qa.png'),
    animations: 'disabled',
    fullPage: false,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await confirm.click();
  await expect(page).toHaveURL('/workspace');
  await expect(dialog).toBeHidden();
});

test('09 member leave confirmation calls the existing flow and returns to workspace', async ({
  page,
}, info) => {
  await page.goto('/teams/2/settings');
  await page.getByRole('button', { name: '팀 나가기', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: '팀 나가기' });
  await expect(
    dialog.getByText('팀을 나가고 다시 들어오실려면 오너의 승인이 필요 합니다. 나가시겠습니까?'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('p09-leave-qa.png'),
      animations: 'disabled',
    fullPage: false,
    scale: 'css',
    style: 'nextjs-portal, details[class*="MockRoleSwitcher"] { visibility: hidden !important; }',
  });
  await dialog.getByRole('button', { name: '팀 나가기', exact: true }).click();
  await expect(page).toHaveURL('/workspace');
  await expect(dialog).toBeHidden();
});


test('09 ownership and AI sheets submit only explicit input', async ({page}, info) => {
  await page.goto('/teams/1/settings?overlay=team-settings-action&oid=transfer');
  await expect(page.getByRole('dialog', {name:'소유권 이전'})).toBeVisible();
  await expect(page.getByRole('button',{name:'이전 요청 보내기'})).toBeDisabled();
  await page.getByLabel('새 오너').selectOption({index:1});
  await page.screenshot({path:info.outputPath('p09-transfer.png'),animations:'disabled'});
  await page.getByRole('button',{name:'이전 요청 보내기'}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('/teams/1/settings?overlay=team-settings-action&oid=ai');
  await expect(page.getByRole('checkbox',{name:'AI 요약 사용'})).toBeVisible();
  await page.getByRole('checkbox',{name:'AI 요약 사용'}).uncheck();
  await page.screenshot({path:info.outputPath('p09-ai.png'),animations:'disabled'});
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => window.history.pushState(null, '', '?overlay=team-settings-action&oid=ai'));
  await expect(page.getByRole('checkbox',{name:'AI 요약 사용'})).not.toBeChecked();
});


test('09 exposes required settings without changing the main page body', async ({page}, info) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button',{name:'팀 설정',exact:true}).click();
  const menu=page.getByRole('dialog',{name:'팀 설정',exact:true});
  await expect(menu.getByRole('button',{name:'소유권 이전',exact:true})).toBeEnabled();
  await expect(menu.getByRole('button',{name:'프로젝트 완료',exact:true})).toBeEnabled();
  await expect(menu.getByRole('button',{name:'팀 보관',exact:true})).toBeEnabled();
  await expect(menu.getByRole('button',{name:'구독 관리',exact:true})).toBeEnabled();
  await expect(menu.getByRole('button',{name:'보드 변경',exact:true})).toHaveCount(0);
  await expect(menu.getByRole('button',{name:'AI 요약 설정',exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('p09-settings-menu.png'),animations:'disabled'});
  await menu.getByRole('button',{name:'플랜 보기',exact:true}).click();
  await expect(page).toHaveURL('/subscribe?teamId=1');
});

test('09 manages invite metadata and shares only a newly available original code', async ({page}, info) => {
  await page.goto('/teams/1/settings');
  await page.getByRole('button',{name:'팀 설정',exact:true}).click();
  await page.getByRole('button',{name:'초대 링크 관리',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'초대 링크 관리',exact:true});
  await expect(dialog.getByRole('button',{name:'초대 링크 폐기'}).first()).toBeVisible();
  await expect(dialog.getByRole('button',{name:'공유',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'초대 링크 만들기',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'공유',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('p09-invite-management.png'),animations:'disabled'});
  const before=await dialog.getByRole('button',{name:'초대 링크 폐기'}).count();
  await dialog.getByRole('button',{name:'초대 링크 폐기'}).last().click();
  await page.getByRole('dialog').getByRole('button',{name:'확인',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button',{name:'팀 설정',exact:true}).click();
  await page.getByRole('button',{name:'초대 링크 관리',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'초대 링크 폐기'})).toHaveCount(before-1);
  await expect(dialog.getByRole('button',{name:'공유',exact:true})).toHaveCount(0);
});

test('09 lets a recipient open the existing incoming ownership request', async ({page}) => {
  await page.goto('/teams/2/settings');
  await page.getByRole('button',{name:'팀 설정',exact:true}).click();
  const menu=page.getByRole('dialog',{name:'팀 설정',exact:true});
  await expect(menu.getByRole('button',{name:'소유권 이전',exact:true})).toHaveCount(0);
  await menu.getByRole('button',{name:'소유권 이전 수락',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'소유권 이전을 수락할까요?'})).toBeVisible();
  await page.getByRole('button',{name:'소유권 이전 수락',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
