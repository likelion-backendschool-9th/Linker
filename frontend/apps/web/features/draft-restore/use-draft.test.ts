import { renderHook } from '@testing-library/react';

import { safeStorage } from '@/lib/browser/safe-storage';

import { useDraft } from './use-draft';

const KEY = 'draft:test:unit';

beforeEach(() => safeStorage.remove(KEY));

it('saves and loads a draft within the retention window', () => {
  const { result } = renderHook(() => useDraft<string>(KEY));
  result.current.save('hello');
  expect(result.current.load()).toBe('hello');
});

it('expires drafts older than seven days', () => {
  safeStorage.set(KEY, { value: 'stale', savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
  const { result } = renderHook(() => useDraft<string>(KEY));
  expect(result.current.load()).toBeNull();
  expect(safeStorage.get(KEY)).toBeNull();
});
