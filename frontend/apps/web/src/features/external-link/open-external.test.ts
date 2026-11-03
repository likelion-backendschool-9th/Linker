import { safeStorage } from '@/lib/browser/safe-storage';

import {
  confirmDomain,
  isDomainConfirmed,
  openExternalNow,
  parseHttpsUrl,
} from './open-external';

vi.mock('@/lib/bridge/native', () => ({
  postToNative: vi.fn(() => false),
}));

beforeEach(() => {
  safeStorage.remove('linker:external-domains');
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseHttpsUrl', () => {
  it('accepts https only', () => {
    expect(parseHttpsUrl('https://example.com/a')?.hostname).toBe('example.com');
    expect(parseHttpsUrl('http://example.com')).toBeNull();
    expect(parseHttpsUrl('not-a-url')).toBeNull();
  });
});

describe('domain confirmation', () => {
  it('remembers a domain after the first confirm', () => {
    expect(isDomainConfirmed('github.com')).toBe(false);
    confirmDomain('github.com');
    expect(isDomainConfirmed('github.com')).toBe(true);
  });
});

describe('openExternalNow', () => {
  it('opens a new tab in the browser when the native bridge is absent', async () => {
    const { postToNative } = await import('@/lib/bridge/native');
    vi.mocked(postToNative).mockReturnValue(false);
    openExternalNow('https://example.com');
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });
});
