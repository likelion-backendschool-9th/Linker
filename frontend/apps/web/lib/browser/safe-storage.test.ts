// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { safeSessionStorage, safeStorage } from './safe-storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage', () => {
  it('브라우저가 없는 서버 환경에서도 오류가 나지 않는다', () => {
    vi.stubGlobal('window', undefined);

    for (const storage of [safeStorage, safeSessionStorage]) {
      expect(storage.get('draft')).toBeNull();
      expect(() => storage.set('draft', { title: '테스트' })).not.toThrow();
      expect(() => storage.remove('draft')).not.toThrow();
    }
  });

  it('데이터를 JSON으로 저장하고 읽고 삭제한다', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };

    vi.stubGlobal('window', {
      localStorage: storage,
    });

    const draft = { title: '로그인 오류 수정' };

    safeStorage.set('draft', draft);

    expect(values.get('draft')).toBe(JSON.stringify(draft));
    expect(safeStorage.get('draft')).toEqual(draft);

    safeStorage.remove('draft');

    expect(safeStorage.get('draft')).toBeNull();
  });

  it('저장된 JSON이 손상됐으면 null을 반환한다', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{invalid-json',
      },
    });

    expect(safeStorage.get('draft')).toBeNull();
  });

  it('브라우저가 저장소 접근을 차단해도 오류가 나지 않는다', () => {
    const blockedWindow = {
      get localStorage() {
        throw new Error('Storage access denied');
      },
      get sessionStorage() {
        throw new Error('Storage access denied');
      },
    };

    vi.stubGlobal('window', blockedWindow);

    for (const storage of [safeStorage, safeSessionStorage]) {
      expect(storage.get('draft')).toBeNull();
      expect(() => storage.set('draft', '내용')).not.toThrow();
      expect(() => storage.remove('draft')).not.toThrow();
    }
  });

  it('저장소의 읽기·쓰기·삭제가 실패해도 오류가 나지 않는다', () => {
    const fail = () => {
      throw new Error('Storage operation failed');
    };

    vi.stubGlobal('window', {
      localStorage: {
        getItem: fail,
        setItem: fail,
        removeItem: fail,
      },
    });

    expect(safeStorage.get('draft')).toBeNull();
    expect(() => safeStorage.set('draft', '내용')).not.toThrow();
    expect(() => safeStorage.remove('draft')).not.toThrow();
  });
});
