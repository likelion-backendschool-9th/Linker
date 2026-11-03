import { expect, test, type Page } from '@playwright/test';
import type { WebToNative } from '@linker/bridge';

declare global {
  interface Window {
    contractMessages?: WebToNative[];
  }
}

const upstream = `http://localhost:${process.env.LINKER_CONTRACT_API_PORT}`;
type Call = { method: string; path: string; hasCookie: boolean; query: Record<string, string> };

async function prepareApp(page: Page) {
  await page.addInitScript(() => {
    window.contractMessages = [];
    window.ReactNativeWebView = {
      postMessage: (raw) => window.contractMessages!.push(JSON.parse(raw).msg),
    };
  });
}

async function beginLogin(page: Page) {
  await page.goto('/workspace?tab=active');
  await page.getByRole('button', { name: 'GitHub로 시작', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.contractMessages ?? []))
    .toEqual(expect.arrayContaining([expect.objectContaining({ type: 'AUTH_GITHUB_START' })]));
  const messages = await page.evaluate(() => window.contractMessages ?? []);
  const auth = messages.find((msg) => msg.type === 'AUTH_GITHUB_START')!;
  return new URL(auth.authorizeUrl!).searchParams.get('state')!;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${upstream}/__test/reset`);
});

test('A callback exchanges once, persists an httpOnly cookie and gives B identifiers only', async ({
  page,
  request,
}) => {
  await prepareApp(page);
  const state = await beginLogin(page);
  await page.goto(
    `/auth/callback?code=contract-code&state=${state}&returnTo=%2Fworkspace%3Ftab%3Dactive`,
  );
  await expect(page).toHaveURL(/\/workspace\?tab=active$/);
  await expect(page.getByRole('heading', { name: '내 팀', exact: true })).toBeVisible();
  const cookie = (await page.context().cookies()).find((item) => item.name === 'linker_session')!;
  expect(cookie.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('linker_session');
  expect(await page.content()).not.toContain(cookie.value);
  await expect
    .poll(() => page.evaluate(() => window.contractMessages ?? []))
    .toEqual(
      expect.arrayContaining([
        { type: 'AUTH_SESSION_SAVE', session: { userId: 701, userType: 'DEVELOPER' } },
      ]),
    );
  const messages = await page.evaluate(() => window.contractMessages ?? []);
  expect(JSON.stringify(messages)).not.toContain(cookie.value);
  await page.reload();
  await expect(page.getByRole('heading', { name: '내 팀', exact: true })).toBeVisible();
  const calls = (await (await request.get(`${upstream}/__test/calls`)).json()) as Call[];
  expect(calls.filter((call) => call.path.endsWith('/auth/github/callback'))).toHaveLength(1);
  expect(calls.some((call) => call.path.endsWith('/user/me') && call.hasCookie)).toBe(true);
  expect(calls.find((call) => call.path.endsWith('/authorize-url'))?.query.client).toBe('app');
  expect((await page.request.get('/api/mock/login/developer')).status()).toBe(404);
});

test('a rejected state leaves the app signed out and exposes A retry UI', async ({ page }) => {
  await prepareApp(page);
  await page.goto('/auth/callback?code=contract-code&state=rejected-state');
  await expect(page.getByRole('heading', { name: '로그인할 수 없어요' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그인을 완료하지 못했어요. 다시 시도해 주세요.',
  );
  expect((await page.context().cookies()).some((cookie) => cookie.name === 'linker_session')).toBe(
    false,
  );
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3137/');
});

test('A sends a new developer to onboarding after the same native callback', async ({
  page,
  request,
}) => {
  await request.post(`${upstream}/__test/reset`, { data: { newUser: true } });
  await prepareApp(page);
  const state = await beginLogin(page);
  await page.goto(`/auth/callback?code=contract-code&state=${state}`);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: '프로필 설정', exact: true })).toBeVisible();
});

test('normal-mode sitemap routes and robots use public cookie-free API partitions', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt', {
    headers: { cookie: 'linker_session=private-test' },
  });
  expect(robots.ok()).toBe(true);
  const rules = await robots.text();
  expect(rules).toContain('Disallow: /admin');
  expect(rules).toContain('Disallow: /api/');
  for (const [kind, path] of [
    ['users', '/u/bridge-contract'],
    ['posts', '/posts/701'],
    ['recruits', '/recruits/701'],
  ]) {
    expect(rules).toContain(`/sitemap/${kind}/0.xml`);
    const xml = await request.get(`/sitemap/${kind}/0.xml`);
    expect(xml.ok()).toBe(true);
    expect(await xml.text()).toContain(`<loc>http://localhost:3137${path}</loc>`);
    expect((await request.get(`/sitemap/${kind}/1.xml`)).status()).toBe(404);
  }
  const calls = (await (await request.get(`${upstream}/__test/calls`)).json()) as Call[];
  expect(calls.filter((call) => call.path.includes('/sitemap/')).length).toBeGreaterThanOrEqual(3);
  expect(
    calls.filter((call) => call.path.includes('/sitemap/')).every((call) => !call.hasCookie),
  ).toBe(true);
});
