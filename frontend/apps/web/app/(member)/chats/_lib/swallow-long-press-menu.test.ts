import { swallowLongPressMenu } from './swallow-long-press-menu';

function contextMenu(target: EventTarget = document.body) {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("cancels the browser's long-press menu on whatever is under the finger, once", () => {
  swallowLongPressMenu();
  // The sheet opened under the finger, so the menu targets it rather than the row
  expect(contextMenu(document.body)).toBe(true);
  expect(contextMenu(document.body)).toBe(false);
});

it('still catches a menu shortly after the finger lifts, then lets right-click through again', () => {
  swallowLongPressMenu();
  window.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(400);
  expect(contextMenu()).toBe(true);

  swallowLongPressMenu();
  window.dispatchEvent(new Event('pointercancel'));
  vi.advanceTimersByTime(500);
  expect(contextMenu()).toBe(false);
});

it('gives up after five seconds even without a release', () => {
  swallowLongPressMenu();
  vi.advanceTimersByTime(5000);
  expect(contextMenu()).toBe(false);
});
