import {
  getNavDepth,
  handlePathChange,
  handlePopState,
  initNavDepth,
} from './nav-depth';

const KEY = 'linker:nav-depth';

beforeEach(() => {
  sessionStorage.clear();
  // Fresh navigation by default so init starts at depth 0
  vi.stubGlobal('performance', {
    getEntriesByType: () => [{ type: 'navigate' }],
  });
  Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nav-depth', () => {
  it('starts at 0 on a fresh navigation so shared-link back stays in-app', () => {
    initNavDepth('/posts/1');
    expect(getNavDepth()).toBe(0);
    expect(sessionStorage.getItem(KEY)).toContain('"/posts/1"');
  });

  it('keeps depth across reload', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ depth: 2, historyLength: 3, path: '/feed' }),
    );
    vi.stubGlobal('performance', {
      getEntriesByType: () => [{ type: 'reload' }],
    });
    initNavDepth('/feed');
    expect(getNavDepth()).toBe(2);
  });

  it('raises depth on push navigation and lowers it on popstate path change', () => {
    initNavDepth('/feed');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
    handlePathChange('/posts/1');
    expect(getNavDepth()).toBe(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/feed' },
    });
    handlePopState();
    handlePathChange('/feed');
    expect(getNavDepth()).toBe(0);
  });

  it('ignores query-only overlay changes that keep the same pathname', () => {
    initNavDepth('/feed');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
    handlePathChange('/feed');
    expect(getNavDepth()).toBe(0);
  });
});
