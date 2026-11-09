import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { LegalDocument } from './LegalDocument';

describe('LegalDocument', () => {
  it('renders terms directly without document chrome and sanitizes unsafe HTML', async () => {
    const { container } = render(
      <LegalDocument
        document={{
          slug: 'terms',
          title: '이용 약관',
          version: '2026-10-01',
          effectiveDate: '2026-10-01',
          body: '# 이용 약관\n\n## 제1조 (목적)\n약관 본문입니다.\n\n<script>alert(1)</script>',
        }}
        documents={[
          { slug: 'terms', title: '이용 약관', version: '2026-10-01', effectiveDate: '2026-10-01' },
        ]}
      />,
    );

    expect(container.querySelector('nav')).not.toBeInTheDocument();
    expect(container.querySelector('.meta')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '제1조 (목적)' })).toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
