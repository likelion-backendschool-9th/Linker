import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import Home from './page';

describe('Home', () => {
  it('renders one h1 with no axe violations', async () => {
    const { container } = render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Linker');
    expect(await axe(container)).toHaveNoViolations();
  });
});
