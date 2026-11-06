import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { LegalDocument } from './LegalDocument';

describe('LegalDocument', () => {
  it('shows the document navigation, metadata, and a working table of contents without unsafe HTML', async () => {
    const { container } = render(
      <LegalDocument
        document={{
          slug: 'terms',
          title: '이용약관',
          version: '2026-10-01',
          effectiveDate: '2026-10-01',
          body: '# 이용약관\n\n## 목적\n\n안전한 문서입니다.\n\n<script>alert(1)</script>',
        }}
        documents={[
          { slug: 'terms', title: '이용약관', version: '2026-10-01', effectiveDate: '2026-10-01' },
        ]}
      />,
    );

    expect(container.querySelector('nav a')).toHaveAttribute('href', '/legal/terms');
    expect(container.querySelector('p')?.textContent).toContain('2026-10-01');
    expect(screen.getByRole('link', { name: '목적' })).toHaveAttribute('href', '#legal-section-1');
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
