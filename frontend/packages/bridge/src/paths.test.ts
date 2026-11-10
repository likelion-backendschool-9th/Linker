import { describe, expect, it } from 'vitest';

import { authCallbackPath, internalPath } from './paths';

describe('authentication deep links', () => {
  it('preserves code/state and the return destination, without forwarding client=app', () => {
    const path = authCallbackPath(
      'linker://auth?code=a%2Bb&state=s&returnTo=%2Fteams%2F1&client=app',
    );
    const url = new URL(path!, 'https://linker.test');
    expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('code')).toBe('a+b');
    expect(url.searchParams.get('returnTo')).toBe('/teams/1');
    expect(url.searchParams.has('client')).toBe(false);
  });

  it.each([
    'linker://auth-evil?code=c&state=s',
    'linker://auth/other?code=c&state=s',
    'https://auth?code=c&state=s',
    'linker://user@auth?code=c&state=s',
    'linker://auth?code=c',
    'linker://auth?state=s',
    'linker://auth?code=c&state=s&state=other',
    'invalid',
  ])('rejects an unrelated or incomplete callback: %s', (url) => {
    expect(authCallbackPath(url)).toBeNull();
  });

  it('passes authentication failure back to the web callback', () => {
    expect(authCallbackPath('linker://auth?error=access_denied&state=s')).toBe(
      '/auth/callback?state=s&error=access_denied',
    );
  });
});

describe('internal destinations', () => {
  it.each([
    '//evil.test',
    '/\\evil.test',
    '/\n/evil.test',
    'https://evil.test',
    'javascript:alert(1)',
    null,
  ])('rejects %s', (path) => expect(internalPath(path)).toBeNull());
  it('keeps query and hash on a normalized same-origin destination', () => {
    expect(internalPath('/teams/1/../2?overlay=report#title')).toBe(
      '/teams/2?overlay=report#title',
    );
  });
});
