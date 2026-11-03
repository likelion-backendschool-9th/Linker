import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAndroidBack } from './android-back';

describe('Android hardware back', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  function setup(canGoBack = false) {
    const actions = {
      askWeb: vi.fn(),
      canGoBack: vi.fn(() => canGoBack),
      goBack: vi.fn(),
      exit: vi.fn(),
      notify: vi.fn(),
    };
    const back = createAndroidBack(actions);
    const reply = (handled: boolean) =>
      back.onBackResult(actions.askWeb.mock.calls.at(-1)![0], handled);
    return { actions, back, reply };
  }

  it('lets the web close an overlay without also navigating its history', () => {
    const { actions, back, reply } = setup(true);
    back.press();
    reply(true);
    vi.advanceTimersByTime(1000);
    expect(actions.goBack).not.toHaveBeenCalled();
    expect(actions.exit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back after 300 ms, and ignores a late result', () => {
    const { actions, back, reply } = setup(true);
    back.press();
    vi.advanceTimersByTime(299);
    expect(actions.goBack).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    reply(false);
    expect(actions.goBack).toHaveBeenCalledOnce();
  });

  it('exits only on the second unhandled press within two seconds, even at clock zero', () => {
    const { actions, back, reply } = setup();
    back.press();
    reply(false);
    expect(actions.notify).toHaveBeenCalledOnce();
    expect(actions.exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1999);
    back.press();
    reply(false);
    expect(actions.exit).toHaveBeenCalledOnce();
  });

  it('starts a new exit window after two seconds or after a sheet closes', () => {
    const { actions, back, reply } = setup();
    back.press();
    reply(false);
    vi.advanceTimersByTime(2000);
    back.press();
    reply(false);
    expect(actions.exit).not.toHaveBeenCalled();
    back.press();
    reply(true);
    back.press();
    reply(false);
    expect(actions.exit).not.toHaveBeenCalled();
    expect(actions.notify).toHaveBeenCalledTimes(3);
  });

  it('does not enqueue repeated presses while waiting, or accept another request ID', () => {
    const { actions, back } = setup(true);
    back.press();
    back.press();
    back.onBackResult('another', false);
    expect(actions.askWeb).toHaveBeenCalledOnce();
    expect(actions.goBack).not.toHaveBeenCalled();
    back.dispose();
    vi.advanceTimersByTime(1000);
    expect(actions.goBack).not.toHaveBeenCalled();
  });

  it('uses native history when injecting a message into the web fails', () => {
    const { actions, back } = setup(true);
    actions.askWeb.mockImplementation(() => {
      throw new Error('web process gone');
    });
    back.press();
    expect(actions.goBack).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
