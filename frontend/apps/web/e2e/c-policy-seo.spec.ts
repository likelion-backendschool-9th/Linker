import { expect, test } from '@playwright/test';

// C foundation stage 2. Uses the existing mock API; it does not validate Spring or GitHub.
test('server HTML includes public content and metadata before client hydration', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    javaScriptEnabled: false,
    userAgent: 'Twitterbot/1.0',
    timezoneId: 'UTC',
  });
  try {
    const page = await context.newPage();
    const response = await page.goto('/feed?from=share');
    expect(response?.status()).toBe(200);
    // Streaming boundaries may stay hidden without JavaScript. Assert server markup,
    // not a no-JavaScript UI guarantee; the next test checks the interactive browser.
    await expect(page.getByRole('link', {
      name: '개발자 팀 찾기부터 협업까지, Linker 웹 클라이언트',
      exact: true,
      includeHidden: true,
    })).toHaveCount(1);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/feed$/);
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', /\/feed$/);
    const robots = await page.locator('head meta[name="robots"]').getAttribute('content');
    expect(robots?.split(/,\s*/)).toContain('index');
  } finally {
    await context.close();
  }
});

test('feed becomes interactive without hydration or uncaught browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto('/feed');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '로그인한 사용자만 쓸 수 있는 기능이에요' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('private issue metadata stays noindex and uses a generic title', async ({ page }) => {
  await page.goto('/api/mock/login/developer?returnTo=%2Fteams%2F1%2Fissues');
  await expect(page).toHaveURL(/\/teams\/1\/issues$/);
  await expect(page).toHaveTitle('이슈 | Linker');
  const robots = await page.locator('head meta[name="robots"]').getAttribute('content');
  expect(robots?.split(/,\s*/)).toContain('noindex');
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', '이슈');
});

test('feed cover images load in the mobile browser', async ({ page }) => {
  await page.goto('/feed');
  const image = page.locator('img[src*="/mock/cover-"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
});

test('Next image optimization processes the local OG image', async ({ request }) => {
  const response = await request.get('/_next/image?url=%2Fog-default.png&w=360&q=75', {
    headers: { Accept: 'image/webp' },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/(webp|avif|png)/);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('robots excludes admin and API paths', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/Disallow:\s*\/admin\b/);
  expect(body).toMatch(/Disallow:\s*\/api\//);
});
