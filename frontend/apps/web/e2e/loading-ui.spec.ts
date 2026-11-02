import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const fixture = 'http://127.0.0.1:3101';

async function box(locator: Locator) {
  return locator.evaluate((element) => {
    const b = element.getBoundingClientRect(),
      s = getComputedStyle(element);
    return {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      color: s.color,
      background: s.backgroundColor,
      radius: s.borderRadius,
      font: s.fontSize,
    };
  });
}
async function pixels(canvas: Locator) {
  return canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    const values = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let hash = 0,
      visible = 0;
    for (let i = 0; i < values.length; i++) {
      const value = values[i] ?? 0;
      hash = (hash * 31 + value) | 0;
      if (i % 4 === 3 && value > 0) visible++;
    }
    return { hash, visible };
  });
}
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
      this.canvas.dataset.frames = String(Number(this.canvas.dataset.frames ?? 0) + 1);
      clear.call(this, x, y, w, h);
    };
  });
}

test('shared pending preserves every button/placeholder footprint at responsive breakpoints', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fixture);
  // Vite injects nested CSS imports; wait for inherited styles, not only the root token.
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(64, 64, 64)');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [360, 600, 639, 640, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('main')).toHaveCSS(
      'padding-left',
      width >= 1024 ? '32px' : width >= 600 ? '24px' : '16px',
    );
    await expect(page.locator('[data-fixture-button] button').first()).toBeEnabled();
    for (const placeholder of await page.locator('[data-placeholder]').all())
      await expect(placeholder).toHaveCSS('color', 'rgb(64, 64, 64)');
    const targets = page.locator('[data-fixture-button] > button, [data-placeholder]');
    const before = [];
    for (const target of await targets.all()) before.push(await box(target));
    await page.locator('[data-toggle]').click();
    await expect(page.locator('[data-fixture-button] button').first()).toBeDisabled();
    const after = [];
    for (const target of await targets.all()) after.push(await box(target));
    expect(after, `footprints @ ${width}`).toEqual(before);
    await expect(
      page.getByRole('button', { name: '저장', exact: true }).first(),
    ).toHaveAccessibleName('저장');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width === 360 || width === 1440)
      await page.screenshot({
        path: testInfo.outputPath(`composing-${width}.png`),
        fullPage: true,
      });
    await page.locator('[data-toggle]').click();
    await expect(page.locator('[data-fixture-button] button').first()).toBeEnabled();
  }
});

test('Composing paints in both presets and remains static for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fixture);
  await page.locator('[data-toggle]').click();
  const compact = page.locator('[data-fixture-inline] canvas');
  const large = page.locator('[data-placeholder="visible"] canvas');
  await expect(compact).toBeVisible();
  await expect(large).toBeVisible();
  expect((await compact.boundingBox())?.width).toBe(20);
  expect((await large.boundingBox())?.width).toBe(64);
  const a = await pixels(compact),
    b = await pixels(large);
  expect(a.visible).toBeGreaterThan(0);
  expect(b.visible).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  expect(await pixels(compact)).toEqual(a);
  expect(await pixels(large)).toEqual(b);
  await expect(page.getByRole('img')).toHaveCount(0);
});

test('the real Canvas loop pauses offscreen, for hidden tabs and for WebView background', async ({
  page,
}) => {
  await instrument(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(fixture);
  const canvas = page.locator('[data-fixture-inline] canvas');
  const frames = async () => Number(await canvas.getAttribute('data-frames'));
  await expect.poll(frames).toBeGreaterThan(2);
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'APP_STATE', state: 'background' },
        }),
      }),
    ),
  );
  await page.waitForTimeout(120);
  const background = await frames();
  await page.waitForTimeout(150);
  expect(await frames()).toBe(background);
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          v: 1,
          source: 'linker',
          msg: { type: 'APP_STATE', state: 'active' },
        }),
      }),
    ),
  );
  await expect.poll(frames).toBeGreaterThan(background + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(120);
  const hidden = await frames();
  await page.waitForTimeout(150);
  expect(await frames()).toBe(hidden);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(frames).toBeGreaterThan(hidden + 1);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  const outside = await frames();
  await page.waitForTimeout(150);
  expect(await frames()).toBe(outside);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(frames).toBeGreaterThan(outside + 1);
});

test('missing Canvas keeps the status and pending guard functional', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto(fixture);
  await expect(page.getByText('목록을 불러오고 있어요.', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '저장', exact: true }).first().click();
  await expect(page.locator('[data-action-count]')).toContainText('실행 1회');
  await page.locator('[data-toggle]').click();
  await expect(page.getByRole('button', { name: '저장', exact: true }).first()).toBeDisabled();
});

test('settled mock app frames, existing preview controls and navigation retain their semantics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .context()
    .addCookies([{ name: 'linker_mock_role', value: 'developer', url: 'http://localhost:3100' }]);
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: '내 팀' })).toBeVisible();
  await expect(page.locator('[data-loading-state]')).toHaveCount(0);
  await page.goto('/teams/new');
  await expect(page.getByRole('button', { name: 'GitHub에서 설치하기' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'GitHub에서 설치하기' }).locator('[data-loading-orb]'),
  ).toHaveCount(0);
  await page.goto('/chats/1');
  await page.getByRole('button', { name: 'PR 목록' }).click();
  await expect(page.getByRole('dialog', { name: 'Pull requests' })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(errors).toEqual([]);
});
