import { act, fireEvent, renderHook } from '@testing-library/react';

import { PULL_THRESHOLD, usePullToRefresh } from './use-pull-to-refresh';

/** Finger at `y`. jsdom has no Touch constructor, so plain objects stand in. */
const touch = (y: number) => ({ touches: [{ clientY: y }] });

function pull(from: number, to: number, target: Window | Element = window) {
  act(() => {
    fireEvent.touchStart(target, touch(from));
    fireEvent.touchMove(target, touch(to));
  });
}

function release(target: Window | Element = window) {
  act(() => {
    fireEvent.touchEnd(target, { touches: [] });
  });
}

beforeEach(() => {
  window.scrollY = 0;
});

it('refreshes when pulled past the threshold at the top of the page', () => {
  const onRefresh = vi.fn();
  const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
  // Resistance halves the finger distance
  pull(0, PULL_THRESHOLD * 2 + 10);
  expect(result.current.ready).toBe(true);
  release();
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(result.current.distance).toBe(0);
});

it('does nothing for a short pull', () => {
  const onRefresh = vi.fn();
  const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
  pull(0, 40);
  expect(result.current.distance).toBeGreaterThan(0);
  expect(result.current.ready).toBe(false);
  release();
  expect(onRefresh).not.toHaveBeenCalled();
});

it('shows the pull but does not refresh while disabled (once a minute)', () => {
  const onRefresh = vi.fn();
  renderHook(() => usePullToRefresh({ onRefresh, disabled: true }));
  pull(0, 400);
  release();
  expect(onRefresh).not.toHaveBeenCalled();
});

it('ignores pulls when the page is scrolled down', () => {
  const onRefresh = vi.fn();
  window.scrollY = 120;
  const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
  pull(0, 400);
  expect(result.current.distance).toBe(0);
  release();
  expect(onRefresh).not.toHaveBeenCalled();
});

it('ignores pulls that start inside an open sheet', () => {
  const onRefresh = vi.fn();
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.append(dialog);
  const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
  pull(0, 400, dialog);
  expect(result.current.distance).toBe(0);
  release(dialog);
  expect(onRefresh).not.toHaveBeenCalled();
  dialog.remove();
});
