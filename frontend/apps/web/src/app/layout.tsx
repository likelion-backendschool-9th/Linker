import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';

import { getSession, viewerFromSession } from '@/lib/auth/session';
import type { ClientViewer } from '@/lib/auth/viewer-context';
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo/seo-flags';

import { Providers } from './providers';

// Root defaults (blueprint §8-2): noindex unless a page opts in through buildMetadata({ indexable: true })
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Linker — 개발자 팀 찾기와 협업', template: '%s | Linker' },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: false, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
};

// No maximumScale / userScalable: zoom is never blocked (blueprint ch. 6)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0f' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();
  const viewer: ClientViewer = {
    role: viewerFromSession(session).role,
    login: session?.login ?? null,
    status: session?.status ?? null,
    suspendedUntil: session?.suspendedUntil ?? null,
  };

  return (
    <html lang="ko">
      <body>
        <Providers viewer={viewer}>{children}</Providers>
      </body>
    </html>
  );
}
