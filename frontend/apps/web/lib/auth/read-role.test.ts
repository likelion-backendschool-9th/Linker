import { isCompactJwt, readCookieViewer } from './read-role';
import { GUEST } from './route-access';

describe('readCookieViewer', () => {
  it('treats a missing cookie as a guest', async () => {
    await expect(readCookieViewer(undefined)).resolves.toEqual({
      kind: 'viewer',
      viewer: GUEST,
    });
  });

  it('does not treat the opaque linker_session secret as a guest', async () => {
    await expect(readCookieViewer('a'.repeat(43))).resolves.toEqual({ kind: 'opaque' });
  });

  it('does not grant a role from an unverified compact token', async () => {
    const result = await readCookieViewer('aaa.bbb.ccc');
    if (process.env.JWT_PUBLIC_KEY) {
      expect(result).toEqual({ kind: 'viewer', viewer: GUEST });
    } else {
      expect(result).toEqual({ kind: 'opaque' });
    }
  });
});

describe('isCompactJwt', () => {
  it('requires three non-empty segments', () => {
    expect(isCompactJwt('aaa.bbb.ccc')).toBe(true);
    expect(isCompactJwt('a'.repeat(43))).toBe(false);
    expect(isCompactJwt('a.b')).toBe(false);
    expect(isCompactJwt('a..c')).toBe(false);
  });
});
