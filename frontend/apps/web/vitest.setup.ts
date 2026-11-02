import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

import { server } from './src/mocks/server';

expect.extend(matchers);

// App Router hooks need a mounted router; tests get a stub. Override per test with vi.mocked(...)
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/feed'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
