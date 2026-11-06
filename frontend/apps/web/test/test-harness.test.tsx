import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { PROFILE } from '@/lib/policy';
import { handlers } from '@/mocks/handlers';
import { server } from '@/mocks/server';

const endpoint = 'https://test-harness.example/api/v1/public/test-harness';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('frontend test harness', () => {
  it('uses a per-test MSW response through the shared API transport', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://test-harness.example');
    server.use(http.get(endpoint, () => HttpResponse.json({ ready: true })));

    await expect(apiFetch('/api/v1/public/test-harness')).resolves.toEqual({ ready: true });
  });

  it('restores default handlers between tests and rejects unhandled requests', async () => {
    expect(server.listHandlers()).toEqual(handlers);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fetch(endpoint)).rejects.toThrow();
  });

  it('runs the global axe matcher on accessible markup using existing policy values', async () => {
    const { container } = render(
      <label>
        표시 이름
        <input name="displayName" maxLength={PROFILE.displayName.max} />
      </label>,
    );

    expect(screen.getByRole('textbox', { name: '표시 이름' })).toHaveAttribute(
      'maxlength',
      String(PROFILE.displayName.max),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('detects an inaccessible fixture so axe cannot silently stop running', async () => {
    const fixture = document.createElement('div');
    const image = document.createElement('img');
    image.src = '/test-harness.png';
    fixture.append(image);
    document.body.append(fixture);
    try {
      const results = await axe(fixture);
      expect(results.violations.map((violation) => violation.id)).toContain('image-alt');
    } finally {
      fixture.remove();
    }
  });
});
