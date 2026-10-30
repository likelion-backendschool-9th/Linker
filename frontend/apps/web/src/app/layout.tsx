import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Linker', template: '%s | Linker' },
  description: '함께 만들 팀원을 찾고, GitHub로 협업하고, 완성한 프로젝트를 공유하세요.',
  robots: { index: false, follow: false },
};

// No maximumScale / userScalable: zoom is never blocked (blueprint ch. 6)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
