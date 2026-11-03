import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';

import { renderWithProviders } from '@/test/render-with-providers';

import { resetOverlayHistory, useOverlay } from './use-overlay';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

function Harness() {
  const report = useOverlay('report');
  const block = useOverlay('block');
  return (
    <>
      <button onClick={() => report.open('POST:1')}>report</button>
      <button onClick={() => block.open('7')}>block</button>
      <button onClick={report.close}>close report</button>
      <button onClick={() => void report.closeThen('/feed')}>leave</button>
      <p>{report.isOpen ? `report ${report.id}` : 'closed'}</p>
    </>
  );
}

describe('useOverlay', () => {
  beforeEach(() => {
    resetOverlayHistory();
    push.mockReset();
  });

  it('pushes on first open and replaces when switching', async () => {
    const updates: UrlUpdateEvent[] = [];
    renderWithProviders(<Harness />, { onUrlUpdate: (event) => updates.push(event) });

    await userEvent.click(screen.getByText('report'));
    expect(screen.getByText('report POST:1')).toBeInTheDocument();
    expect(updates.at(-1)?.options.history).toBe('push');
    expect(updates.at(-1)?.searchParams.get('overlay')).toBe('report');

    await userEvent.click(screen.getByText('block'));
    expect(updates.at(-1)?.options.history).toBe('replace');
    expect(updates.at(-1)?.searchParams.get('overlay')).toBe('block');
  });

  it('closes a pushed overlay with history.back()', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByText('report'));
    await userEvent.click(screen.getByText('close report'));
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it('closes a URL-entered overlay with replace, never push', async () => {
    const updates: UrlUpdateEvent[] = [];
    const back = vi.spyOn(window.history, 'back');
    renderWithProviders(<Harness />, {
      searchParams: '?overlay=report&oid=POST:1',
      onUrlUpdate: (event) => updates.push(event),
    });

    await userEvent.click(screen.getByText('close report'));
    expect(back).not.toHaveBeenCalled();
    expect(updates.at(-1)?.options.history).toBe('replace');
    expect(updates.at(-1)?.searchParams.has('overlay')).toBe(false);
    back.mockRestore();
  });

  it('does nothing when reopening the same overlay with the same oid', async () => {
    const updates: UrlUpdateEvent[] = [];
    renderWithProviders(<Harness />, {
      searchParams: '?overlay=report&oid=POST:1',
      onUrlUpdate: (event) => updates.push(event),
    });

    await userEvent.click(screen.getByText('report'));
    expect(updates).toHaveLength(0);
  });

  it('closeThen closes first then navigates away', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByText('report'));
    await userEvent.click(screen.getByText('leave'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/feed'));
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });
});
