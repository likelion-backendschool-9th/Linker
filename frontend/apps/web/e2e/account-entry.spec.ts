import { expect, test } from '@playwright/test';

test('guest can start the mock GitHub login and browse the feed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: '둘러보기' }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto('/');
  await page.getByRole('button', { name: 'GitHub로 시작' }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test('onboarding validates consent, saves the profile and reaches the feed', async ({ page }) => {
  await page.goto('/api/mock/login/newcomer?returnTo=/onboarding');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('form span[role="alert"]')).toHaveCount(3);

  await page.getByLabel(/만 14세 이상입니다/).check();
  await page.getByLabel(/이용약관에 동의합니다/).check();
  await page.getByLabel(/개인정보 처리방침에 동의합니다/).check();
  await page.getByLabel(/마케팅 정보 수신에 동의합니다/).check();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '기본 프로필을 확인해 주세요' })).toBeVisible();

  await page.getByRole('button', { name: '기술 스택 선택' }).click();
  const picker = page.getByRole('dialog', { name: '기술 스택 선택' });
  await picker.getByRole('checkbox', { name: 'React', exact: true }).check();
  await picker.getByRole('button', { name: '선택 완료' }).click();
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByRole('heading', { name: '프로필 설정이 완료됐어요' })).toBeVisible();
  await page.getByRole('button', { name: '피드로 이동' }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test('guest can read a legal document and an unknown slug returns 404', async ({ page }) => {
  await page.goto('/legal/terms');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '문서 목차' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '약관 및 정책 문서' })).toBeVisible();

  const response = await page.goto('/legal/unknown-document');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main a[href="/feed"]')).toBeVisible();
});

test('callback shows an error without OAuth parameters and completes a mock callback', async ({
  page,
}) => {
  await page.goto('/auth/callback?error=access_denied');
  await expect(page.getByRole('heading', { name: '로그인할 수 없어요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();

  await page.goto('/auth/callback?code=mock-code&state=mock-state&returnTo=%2Ffeed');
  await expect(page).toHaveURL(/\/feed$/);
});

test('public profiles branch by owner type and ownership', async ({ page }) => {
  await page.goto('/u/seoyeon-park');
  await expect(page.locator('#page-title')).toHaveText('박서연');
  await page.getByRole('button', { name: '팔로우' }).click();
  await expect(page).toHaveURL(/overlay=login/);

  await page.goto('/api/mock/login/developer?returnTo=%2Fu%2Fseoyeon-park');
  await expect(page.getByRole('button', { name: '팔로우' })).toBeVisible();
  await page.getByRole('button', { name: '팔로우' }).click();
  await expect(page.getByRole('button', { name: '팔로잉', exact: true })).toBeVisible();

  await page.goto('/u/r-1001');
  await expect(page.getByText('인증된 회사 이메일')).toBeVisible();
  await expect(page.getByRole('button', { name: '팔로우' })).toHaveCount(0);
  await page.goto('/u/seojun-han');
  await expect(page.getByRole('link', { name: '프로필 편집' })).toBeVisible();
  await page.goto('/u/no-such-login');
  // The loading.tsx shell can stream HTTP 200 before the Server Component resolves
  // notFound(); verify the final, visible 404 state instead.
  await expect(page.getByRole('heading', { name: '볼 수 없는 콘텐츠' })).toBeVisible();

  await page.goto('/api/mock/login/recruiter?returnTo=%2Fu%2Fminjae-choi');
  await expect(page.getByText('제안 받는 중')).toBeVisible();
  await expect(page.getByRole('button', { name: '팔로우' })).toHaveCount(0);
  await page.goto('/u/r-1001');
  await expect(page.getByRole('link', { name: '프로필 편집' })).toBeVisible();
});

test('profile edit route uses role-specific forms and respects developer-only fields', async ({
  page,
}) => {
  await page.goto('/api/mock/login/developer?returnTo=%2Fsettings%2Fprofile');
  await expect(page.getByRole('group', { name: /관심 직군/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GitHub에서 다시 불러오기' })).toBeVisible();
  await page.getByLabel('이름').fill('변경된 이름');
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '나가기' }).click();
  await expect(page).toHaveURL(/\/u\/seojun-han$/);

  await page.goto('/api/mock/login/recruiter?returnTo=%2Fsettings%2Fprofile');
  await expect(page.getByLabel('회사 이메일')).toHaveAttribute('readonly');
  await expect(page.getByText('관심 직군')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'GitHub에서 다시 불러오기' })).toHaveCount(0);
});
