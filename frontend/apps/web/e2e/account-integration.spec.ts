import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('settings and recruiter offers branch on the authenticated role', async ({ page }) => {
  await page.goto('/api/mock/login/developer?returnTo=%2Fsettings');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'GitHub 연결' })).toBeVisible();
  await expect(page.getByText('@seojun-han', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '푸시 알림' }).click();
  await expect(page.getByRole('button', { name: '푸시 알림' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '차단한 사용자 보기' }).click();
  await expect(page.getByRole('dialog', { name: '차단한 사용자' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '차단한 사용자' })).toBeVisible();

  await page.goto('/api/mock/login/recruiter?returnTo=%2Fsettings');
  await expect(page.getByRole('heading', { name: 'Scout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GitHub 연결' })).toHaveCount(0);
  await expect(page.getByText('@r-1001', { exact: true })).toBeVisible();

  await page.goto('/api/mock/login/recruiter?returnTo=%2Frecruiter%2Foffers');
  await expect(page.getByRole('heading', { name: '보낸 채용 제안' })).toBeVisible();
  await expect(page.getByRole('button', { name: /대화 중/ })).toBeVisible();
  await expect(page.getByText('볼 수 없는 사용자')).toHaveCount(0);
  await page.getByRole('button', { name: /응답 대기/ }).click();
  await expect(page.getByRole('button', { name: '보낸 메시지 보기' }).first()).toBeVisible();
  await page.getByRole('button', { name: '보낸 메시지 보기' }).first().click();
  await expect(page.getByRole('dialog', { name: '보낸 메시지' })).toBeVisible();
  await expect(page.getByText(/프로필에서 RAG 프로젝트/)).toBeVisible();
});

test('recruiter sign-up verifies email and routes the mock account into the app', async ({ page }) => {
  await page.goto('/recruiter/signup');
  await expect(page.getByRole('heading', { name: '기업회원 가입 동의' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('서비스 이용약관에 동의해 주세요.')).toBeVisible();

  await page.getByLabel('(필수) 만 19세 이상입니다').check();
  await page.getByLabel('(필수) 서비스 이용약관 동의').check();
  await page.getByLabel('(필수) 기업회원(채용 담당자) 추가약관 동의').check();
  await page.getByLabel('(필수) 기업회원 개인정보 수집·이용 동의').check();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('회사 이메일').fill('qa@linker.example');
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await page.getByLabel('인증 코드').fill('123456');
  await page.getByRole('button', { name: '이메일 인증하기' }).click();
  await expect(page.getByRole('heading', { name: '담당자 및 회사 정보' })).toBeVisible();
  await page.getByLabel('담당자 이름').fill('테스트 담당자');
  await page.getByLabel('회사명').fill('테스트 회사');
  await page.getByLabel('직책').fill('채용 담당자');
  await page.getByLabel('비밀번호', { exact: true }).fill('qaPassword1234');
  await page.getByLabel('비밀번호 확인').fill('qaPassword1234');
  await page.getByRole('button', { name: '회원가입 완료' }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.goto('/recruiter/offers');
  await expect(page.getByRole('heading', { name: '보낸 채용 제안' })).toBeVisible();
});

test('recruiter login, safe returnTo, and reset-link states use the recruiter mock session', async ({ page }) => {
  await page.goto('/recruiter/login?returnTo=%2Fsettings%2Fprofile');
  await page.getByLabel('회사 이메일').fill('wrong@nextlab.example');
  await page.getByLabel('비밀번호').fill('incorrect-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('이메일 또는 비밀번호가 맞지 않아요', { exact: true })).toBeVisible();

  await page.getByLabel('회사 이메일').fill('jihyun.song@nextlab.example');
  await page.getByLabel('비밀번호').fill('password1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole('heading', { name: '프로필 수정' })).toBeVisible();

  await page.goto('/api/mock/login/guest?returnTo=%2Frecruiter%2Freset');
  await page.getByLabel('회사 이메일').fill('not-registered@nextlab.example');
  await page.getByRole('button', { name: '재설정 링크 받기' }).click();
  await expect(page.getByRole('status')).toContainText('등록된 이메일이라면 재설정 링크를 보냈어요');
  await page.goto('/recruiter/reset?token=expired-token');
  await expect(page.getByRole('heading', { name: '링크가 만료됐어요' })).toBeVisible();
  await page.goto('/recruiter/reset?token=valid-token');
  await expect(page.getByRole('heading', { name: '새 비밀번호 설정' })).toBeVisible();
  await expect(page.getByLabel('새 비밀번호', { exact: true })).toBeVisible();
  await expect(page.getByLabel('새 비밀번호 확인')).toBeVisible();
});

test('operator reports stay hidden until mock OTP, then detail and review actions work', async ({ page }) => {
  await page.clock.install();
  await page.goto('/api/mock/login/operator?returnTo=%2Fadmin');
  await expect(page).toHaveURL(/\/admin\/reports$/);
  await expect(page.getByRole('heading', { name: '운영자 추가 인증' })).toBeVisible();
  await page.getByLabel('인증 코드').fill('000000');
  await page.getByRole('button', { name: '인증하고 신고 보기' }).click();
  await expect(page.getByText('인증 코드가 맞지 않아요', { exact: true })).toBeVisible();

  await page.getByLabel('인증 코드').fill('123456');
  await page.getByRole('button', { name: '인증하고 신고 보기' }).click();
  await expect(page.getByRole('heading', { name: '운영 · 신고 처리' })).toBeVisible();
  await expect(page.getByRole('button', { name: /#1 · 게시물/ })).toBeVisible();
  await page.getByRole('button', { name: /#1 · 게시물/ }).click();
  await expect(page.getByRole('heading', { name: '게시물 신고' })).toBeVisible();
  await page.getByLabel(/처리 사유/).fill('Mock 통합 테스트 사유');
  await page.getByRole('button', { name: '숨기기', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '숨기기', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '신고 처리를 저장했어요' })).toBeVisible();

  await page.getByRole('button', { name: '이의 제기' }).click();
  await expect(page.getByText(/이의 제기 #1/)).toBeVisible();
  await page.getByRole('button', { name: '수용', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '결정 저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '이의 제기 결정을 저장했어요' })).toBeVisible();

  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.getByRole('heading', { name: '운영자 추가 인증' })).toBeVisible();
});

test('non-operator roles follow the route access matrix and app pages fit target widths', async ({ page }) => {
  await page.goto('/api/mock/login/guest?returnTo=%2Fsettings');
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
  await page.goto('/api/mock/login/newcomer?returnTo=%2Fsettings%2Fprofile');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto('/api/mock/login/developer?returnTo=%2Frecruiter%2Foffers');
  await expect(page).toHaveURL(/\/feed$/);
  await page.goto('/api/mock/login/recruiter?returnTo=%2Fonboarding');
  await expect(page).toHaveURL(/\/feed$/);
  const admin = await page.goto('/admin/reports');
  expect(admin?.status()).toBe(404);

  await page.goto('/legal/terms');
  for (const width of [360, 600, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test('developer and recruiter profile edits validate, save in the current mock session, and refresh', async ({ page }) => {
  await page.goto('/api/mock/login/developer?returnTo=%2Fsettings%2Fprofile');
  await expect(page.getByRole('heading', { name: '프로필 수정' })).toBeVisible();
  await page.getByRole('button', { name: '기술 스택 선택' }).click();
  await expect(page.getByRole('dialog', { name: '기술 스택 선택' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('이름').fill(' ');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('이름을 입력해 주세요.')).toBeVisible();

  await page.getByLabel('이름').fill('통합 QA 개발자');
  await page.getByLabel('블로그 주소').fill('http://not-secure.example');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('블로그 주소는 https로 시작해야 해요.')).toBeVisible();
  await page.getByLabel('블로그 주소').fill('https://qa.example');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('프로필을 저장했어요');
  await expect(page.getByLabel('이름')).toHaveValue('통합 QA 개발자');

  // The browser mock has separate client and server memory; a full reload reads its original server fixture.
  await page.reload();
  await expect(page.getByLabel('이름')).not.toHaveValue('통합 QA 개발자');

  await page.goto('/api/mock/login/recruiter?returnTo=%2Fsettings%2Fprofile');
  await expect(page.getByRole('heading', { name: '프로필 수정' })).toBeVisible();
  await page.getByLabel('회사명').clear();
  await page.getByLabel('회사명').fill('통합 QA 회사');
  await expect(page.getByLabel('회사명')).toHaveValue('통합 QA 회사');
  await page.getByLabel('회사 웹사이트').fill('http://not-secure.example');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('회사 웹사이트는 https 주소를 입력해 주세요.')).toBeVisible();
  await page.getByLabel('회사 웹사이트').fill('https://company.example');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('프로필을 저장했어요');
  await expect(page.getByLabel('회사명')).toHaveValue('통합 QA 회사');
  await expect(page.getByLabel('회사 이메일')).toHaveAttribute('readonly');
});

test('recruiter account settings validate password, update notifications, and logout', async ({ page }) => {
  await page.goto('/api/mock/login/recruiter?returnTo=%2Fsettings');
  await page.getByLabel('알림 이메일').fill('not-an-email');
  await page.getByRole('button', { name: '알림 이메일 저장' }).click();
  await expect(page.getByText('올바른 이메일 주소를 입력해 주세요.')).toBeVisible();
  await page.getByLabel('알림 이메일').fill('alerts@nextlab.example');
  await page.getByRole('button', { name: '알림 이메일 저장' }).click();
  await expect(page.getByRole('status')).toContainText('알림 이메일을 저장했어요');

  await page.getByLabel('현재 비밀번호').fill('wrong-password');
  await page.getByLabel('새 비밀번호', { exact: true }).fill('short');
  await page.getByLabel('새 비밀번호 확인').fill('different');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByText('새 비밀번호는 8자 이상 입력해 주세요.')).toBeVisible();
  await page.getByLabel('새 비밀번호', { exact: true }).fill('newPassword123');
  await page.getByLabel('새 비밀번호 확인').fill('newPassword123');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByText('현재 비밀번호가 맞지 않아요', { exact: true })).toBeVisible();
  await page.getByLabel('현재 비밀번호').fill('password1234');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByText('알림 비밀번호를 변경했어요.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '로그아웃' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
});

test('developer logout and owned-team withdrawal guard preserve the account until explicit resolution', async ({ page }) => {
  await page.goto('/api/mock/login/developer?returnTo=%2Fsettings');
  await page.getByRole('button', { name: '계정 탈퇴' }).click();
  const sheet = page.getByRole('dialog', { name: '계정 탈퇴 안내' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/소유권을 이전하거나 팀을 삭제한 뒤 탈퇴할 수 있어요/)).toBeVisible();
  await expect(sheet.getByRole('button', { name: '탈퇴 계속하기' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
  await page.goto('/settings/profile');
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
});

test('recruiter withdrawal uses the two-step confirmation and clears the mock session', async ({ page }) => {
  await page.goto('/api/mock/login/recruiter?returnTo=%2Fsettings');
  await page.getByRole('button', { name: '계정 탈퇴' }).click();
  const sheet = page.getByRole('dialog', { name: '계정 탈퇴 안내' });
  await expect(sheet.getByText('소유한 팀이 없어 탈퇴를 진행할 수 있어요.')).toBeVisible();
  await sheet.getByRole('button', { name: '탈퇴 계속하기' }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '계정 탈퇴' }).click();
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/feed\?overlay=login/);
});

test('recruiter signup rejects missing consent, free or taken domains, and bad verification codes', async ({ page }) => {
  await page.goto('/recruiter/signup');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('만 19세 이상인지 확인해 주세요.')).toBeVisible();
  await page.getByLabel('(필수) 만 19세 이상입니다').check();
  await page.getByLabel('(필수) 서비스 이용약관 동의').check();
  await page.getByLabel('(필수) 기업회원(채용 담당자) 추가약관 동의').check();
  await page.getByLabel('(필수) 기업회원 개인정보 수집·이용 동의').check();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('회사 이메일').fill('person@gmail.com');
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  const signup = page.getByRole('region', { name: '채용 담당자 회원가입' });
  await expect(signup.getByRole('alert')).toContainText('회사 메일로만 가입할 수 있어요');
  await page.getByLabel('회사 이메일').fill('taken@nextlab.example');
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await expect(signup.getByRole('alert')).toContainText('이미 가입된 이메일이에요');
  await page.getByLabel('회사 이메일').fill('qa@linker.example');
  await page.getByRole('button', { name: /인증 코드 받기/ }).click();
  await expect(page.getByRole('button', { name: /인증 코드 다시 받기/ })).toBeDisabled();
  await page.getByLabel('인증 코드').fill('000000');
  await page.getByRole('button', { name: '이메일 인증하기' }).click();
  await expect(signup.getByRole('alert')).toContainText('인증 코드가 맞지 않아요');
});

test('reset link validates the new password and returns to recruiter login on mock success', async ({ page }) => {
  await page.goto('/recruiter/reset?token=valid-token');
  await page.getByLabel('새 비밀번호', { exact: true }).fill('short');
  await page.getByLabel('새 비밀번호 확인').fill('short');
  await page.getByRole('button', { name: '비밀번호 재설정' }).click();
  await expect(page.getByText('비밀번호는 8자 이상 입력해 주세요.')).toBeVisible();

  await page.getByLabel('새 비밀번호', { exact: true }).fill('newPassword123');
  await page.getByLabel('새 비밀번호 확인').fill('newPassword456');
  await page.getByRole('button', { name: '비밀번호 재설정' }).click();
  await expect(page.getByText('비밀번호가 일치하지 않아요.')).toBeVisible();
  await page.getByLabel('새 비밀번호 확인').fill('newPassword123');
  await page.getByRole('button', { name: '비밀번호 재설정' }).click();
  await expect(page).toHaveURL(/\/recruiter\/login$/);
  await expect(page.getByRole('status')).toContainText('비밀번호를 재설정했어요');
});

test('recruiter login locks after repeated failures and rejects external returnTo redirects', async ({ page }) => {
  await page.goto('/recruiter/login?returnTo=https%3A%2F%2Fevil.example');
  await page.getByLabel('회사 이메일').fill('jihyun.song@nextlab.example');
  await page.getByLabel('비밀번호').fill('password1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page).not.toHaveURL(/evil\.example/);

  await page.goto('/api/mock/login/guest?returnTo=%2Frecruiter%2Flogin');
  await page.getByLabel('회사 이메일').fill('wrong@nextlab.example');
  await page.getByLabel('비밀번호').fill('incorrect-password');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page.getByText('이메일 또는 비밀번호가 맞지 않아요', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('region', { name: '채용 담당자 로그인' }).getByRole('alert')).toContainText('10분');
});

test('recruiter offer filter remains in the URL across refresh and unavailable users stay anonymous', async ({ page }) => {
  await page.goto('/api/mock/login/recruiter?returnTo=%2Frecruiter%2Foffers');
  await page.getByRole('button', { name: /응답 없음/ }).click();
  await expect(page).toHaveURL(/status=NO_RESPONSE/);
  await expect(page.getByText('볼 수 없는 사용자')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/status=NO_RESPONSE/);
  await expect(page.getByText('볼 수 없는 사용자')).toBeVisible();
  await page.getByRole('button', { name: /응답 대기/ }).click();
  await expect(page).toHaveURL(/status=WAITING/);
  await page.locator('a[href^="/u/"]').first().click();
  await expect(page).toHaveURL(/\/u\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/recruiter\/offers\?status=WAITING/);
  await page.goForward();
  await expect(page).toHaveURL(/\/u\//);
});

test('admin filters reports and exercises delete, dismiss, and restore actions individually', async ({ page }) => {
  await page.goto('/api/mock/login/operator?returnTo=%2Fadmin%2Freports');
  await page.getByLabel('인증 코드').fill('123456');
  await page.getByRole('button', { name: '인증하고 신고 보기' }).click();
  await expect(page.getByRole('heading', { name: '운영 · 신고 처리' })).toBeVisible();

  await page.getByLabel('처리 상태').selectOption('HANDLED');
  await expect(page).toHaveURL(/status=HANDLED/);
  await expect(page.getByRole('button', { name: /#5 · 댓글/ })).toBeVisible();
  await page.getByRole('button', { name: /#5 · 댓글/ }).click();
  await page.getByRole('button', { name: '복원', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '복원', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('신고 처리를 저장했어요');

  await page.getByLabel('처리 상태').selectOption('PENDING');
  await page.getByLabel('대상 유형').selectOption('RECRUIT_POST');
  await expect(page).toHaveURL(/targetType=RECRUIT_POST/);
  await expect(page.getByRole('button', { name: /#3 · 팀 모집 글/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /#1 · 게시물/ })).toHaveCount(0);
  await page.getByLabel('대상 유형').selectOption('ALL');
  await page.getByLabel('접수 기한').selectOption('true');
  await expect(page.getByRole('button', { name: /#2 · 팀 채팅/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /#3 · 팀 모집 글/ })).toHaveCount(0);
  await page.getByLabel('접수 기한').selectOption('false');
  await page.getByLabel('접수일 정렬').selectOption('oldest');
  await expect(page).toHaveURL(/sort=oldest/);
  await page.getByLabel('신고 ID 또는 사용자 검색').fill('3');
  await expect(page).toHaveURL(/q=3/);
  await expect(page.getByRole('button', { name: /#3 · 팀 모집 글/ })).toBeVisible();

  await page.getByLabel('신고 ID 또는 사용자 검색').fill('');
  await page.getByRole('button', { name: /#3 · 팀 모집 글/ }).click();
  await page.getByLabel(/처리 사유/).fill('삭제 조치 검증 사유');
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('신고 처리를 저장했어요');

  await page.getByRole('button', { name: /#4 · 채용 광고/ }).click();
  await page.getByRole('button', { name: '기각', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '기각', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('신고 처리를 저장했어요');
});

test('assigned page routes fit all documented widths and pass axe WCAG checks', async ({ page }) => {
  const routes: { path: string; role?: 'guest' | 'developer' | 'newcomer' | 'recruiter' | 'operator' }[] = [
    { path: '/', role: 'guest' },
    { path: '/auth/callback?error=access_denied', role: 'guest' },
    { path: '/onboarding', role: 'newcomer' },
    { path: '/legal/terms', role: 'guest' },
    { path: '/u/seoyeon-park', role: 'guest' },
    { path: '/settings/profile', role: 'developer' },
    { path: '/settings', role: 'recruiter' },
    { path: '/admin/reports', role: 'operator' },
    { path: '/recruiter/signup', role: 'guest' },
    { path: '/recruiter/login', role: 'guest' },
    { path: '/recruiter/reset?token=expired-token', role: 'guest' },
    { path: '/recruiter/offers', role: 'recruiter' },
  ];
  const widths = [360, 600, 1024, 1440];

  for (const { path, role = 'guest' } of routes) {
    if (role === 'guest') {
      await page.goto(path);
    } else {
      await page.goto(`/api/mock/login/${role}?returnTo=${encodeURIComponent(path)}`);
    }
    if (path === '/admin/reports') {
      await page.getByLabel('인증 코드').fill('123456');
      await page.getByRole('button', { name: '인증하고 신고 보기' }).click();
    }
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 360, height: 740 });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations, `${path} axe violations`).toEqual([]);
  }
});
