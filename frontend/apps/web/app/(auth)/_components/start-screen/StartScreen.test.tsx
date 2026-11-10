import { renderWithProviders } from '@/test/render-with-providers';

import { StartScreen } from './StartScreen';

describe('StartScreen', () => {
  it('shows browse and legal navigation', () => {
    const { container } = renderWithProviders(<StartScreen />);
    const links = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));

    expect(links).toEqual(expect.arrayContaining(['/feed', '/legal/terms', '/legal/privacy', '/recruiter/login']));
    expect(container.querySelector('a[href="/recruiter/login"]')).toHaveTextContent('채용 담당자이신가요?');
    expect(container).toHaveTextContent('개발자 SNS의 새로운 패러다임');
    expect(container).toHaveTextContent('로그인 시 위 약관에 동의한 것으로 간주 됩니다.');
  });
});
