import { renderWithProviders } from '@/test/render-with-providers';

import { StartScreen } from './StartScreen';

describe('StartScreen', () => {
  it('shows browse and legal navigation', () => {
    const { container } = renderWithProviders(<StartScreen />);
    const links = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));

    expect(links).toEqual(expect.arrayContaining(['/feed', '/legal/terms', '/legal/privacy']));
  });
});
