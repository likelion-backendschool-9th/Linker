import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { Button } from './button';
import { LoadingIndicator } from './loading-indicator';
import { Skeleton } from './skeleton';

const vendor = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('thinking-orbs', () => ({
  ThinkingOrb: (props: Record<string, unknown>) => {
    vendor.render(props);
    return <canvas aria-hidden="true" data-vendor-orb />;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vendor.render.mockClear();
});

function canvasAvailable() {
  vi.stubGlobal('CanvasRenderingContext2D', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = original(element, pseudo);
    if (element.hasAttribute('data-loading-orb')) {
      return new Proxy(style, {
        get(target, property) {
          if (property === 'color') return 'rgb(64, 64, 64)';
          if (property === 'getPropertyValue')
            return (name: string) =>
              name === '--color-on-primary'
                ? '#ffffff'
                : name === '--color-status-error'
                  ? '#b91c1c'
                  : target.getPropertyValue(name);
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }
    return style;
  });
}

it('has one Korean status and preserves the placeholder even without Canvas', () => {
  const { container } = render(
    <LoadingIndicator label="목록을 불러오고 있어요." variant="block">
      <Skeleton count={3} />
    </LoadingIndicator>,
  );
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오고 있어요.');
  expect(container.querySelectorAll('[data-skeleton-block]')).toHaveLength(3);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(container.querySelector('[data-loading-orb]')).toHaveAttribute('aria-hidden', 'true');
  expect(vendor.render).not.toHaveBeenCalled();
});

it('does not duplicate a containing live region and keeps a hidden status row out of layout', () => {
  render(
    <LoadingIndicator label="확인 중…" announce={false} labelHidden>
      <Skeleton />
    </LoadingIndicator>,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('확인 중…')).toHaveClass('sr-only');
});

it('uses Composing with the fixed preset and pauses/resumes on WebView app events', () => {
  canvasAvailable();
  render(<LoadingIndicator label="불러오는 중…" />);
  expect(vendor.render).toHaveBeenLastCalledWith(
    expect.objectContaining({
      state: 'composing',
      size: 20,
      speed: 1,
      paused: false,
      theme: 'light',
    }),
  );
  const send = (state: string) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ v: 1, source: 'linker', msg: { type: 'APP_STATE', state } }),
        }),
      );
    });
  send('background');
  expect(vendor.render).toHaveBeenLastCalledWith(expect.objectContaining({ paused: true }));
  send('active');
  expect(vendor.render).toHaveBeenLastCalledWith(expect.objectContaining({ paused: false }));
});

it('resolves inverse ink from the existing token, including when its tone changes', () => {
  canvasAvailable();
  const { rerender } = render(<LoadingIndicator label="확인 중…" />);
  rerender(<LoadingIndicator label="확인 중…" tone="inverse" />);
  expect(vendor.render).toHaveBeenLastCalledWith(
    expect.objectContaining({ theme: 'dark', color: '#ffffff' }),
  );
});

it('pending disables only the native action, keeps its accessible name, and announces separately', async () => {
  const onClick = vi.fn();
  const { rerender } = render(<Button onClick={onClick}>저장</Button>);
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <Button pending pendingLabel="저장 중…" onClick={onClick}>
      저장
    </Button>,
  );
  const button = screen.getByRole('button', { name: '저장' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('저장 중…');
  expect(button).not.toContainElement(screen.getByRole('status'));
  await userEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(<Button onClick={onClick}>저장</Button>);
  expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('disabled preview actions do not become loaders, and asChild stays a single link', () => {
  const { container, rerender } = render(<Button disabled>미리보기</Button>);
  expect(container.querySelector('[data-loading-state]')).toBeNull();
  rerender(
    <Button asChild>
      <a href="/feed">피드</a>
    </Button>,
  );
  expect(screen.getByRole('link', { name: '피드' })).toHaveAttribute('href', '/feed');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
