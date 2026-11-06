import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useIsClient } from './use-is-client';

function ClientState() {
  return <output>{useIsClient() ? 'client' : 'server'}</output>;
}

describe('useIsClient', () => {
  it('keeps the server snapshot for hydration, then enables browser rendering', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<ClientState />);
    document.body.append(container);
    expect(container.textContent).toBe('server');

    const hydrationErrors: unknown[] = [];
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <ClientState />, {
          onRecoverableError: (error) => hydrationErrors.push(error),
        });
      });
      expect(container.textContent).toBe('client');
      expect(hydrationErrors).toEqual([]);
    } finally {
      if (root) await act(async () => root!.unmount());
      container.remove();
    }
  });
});
