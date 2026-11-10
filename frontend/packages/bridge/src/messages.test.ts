import { describe, expect, it } from 'vitest';

import { decodeNativeToWeb, decodeWebToNative, encodeEnvelope } from './messages';

describe('bridge envelope', () => {
  it('round-trips a valid message', () => {
    const raw = encodeEnvelope({ type: 'BACK_PRESSED', id: 'b1' });
    expect(decodeNativeToWeb(raw)).toEqual({ type: 'BACK_PRESSED', id: 'b1' });
  });

  it('rejects other sources, versions and shapes', () => {
    expect(
      decodeNativeToWeb(JSON.stringify({ v: 1, source: 'other', msg: { type: 'READY' } })),
    ).toBeNull();
    expect(
      decodeWebToNative(JSON.stringify({ v: 2, source: 'linker', msg: { type: 'READY' } })),
    ).toBeNull();
    expect(decodeNativeToWeb('{not json')).toBeNull();
    expect(decodeNativeToWeb({ type: 'READY' })).toBeNull();
  });

  it('allows only https for OPEN_EXTERNAL', () => {
    const http = encodeEnvelope({ type: 'OPEN_EXTERNAL', url: 'http://example.com' });
    expect(decodeWebToNative(http)).toBeNull();
    const https = encodeEnvelope({ type: 'OPEN_EXTERNAL', url: 'https://example.com' });
    expect(decodeWebToNative(https)).not.toBeNull();
  });

  it('accepts only same-origin deep link paths', () => {
    expect(
      decodeNativeToWeb(encodeEnvelope({ type: 'DEEP_LINK', path: 'https://evil.test' })),
    ).toBeNull();
  });

  it('rejects incomplete results and invalid session identifiers', () => {
    expect(decodeNativeToWeb(encodeEnvelope({ type: 'RESULT', id: 'r', ok: false }))).toBeNull();
    expect(
      decodeNativeToWeb(encodeEnvelope({ type: 'RESULT', id: 'r', ok: true, error: 'failed' })),
    ).toBeNull();
    expect(
      decodeWebToNative(
        encodeEnvelope({
          type: 'AUTH_SESSION_SAVE',
          session: { userId: -1, userType: 'DEVELOPER' },
        }),
      ),
    ).toBeNull();
  });

  it('keeps only userId and userType when a session message carries a token', () => {
    const raw = JSON.stringify({
      v: 1,
      source: 'linker',
      msg: {
        type: 'AUTH_SESSION_SAVE',
        session: { userId: 7, userType: 'RECRUITER', token: 'compact.jwt.value' },
      },
    });
    expect(decodeWebToNative(raw)).toEqual({
      type: 'AUTH_SESSION_SAVE',
      session: { userId: 7, userType: 'RECRUITER' },
    });
  });
});
