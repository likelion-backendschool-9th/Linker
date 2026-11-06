import type { MetadataRoute } from 'next';

export const SITEMAP_KINDS = ['posts', 'recruits', 'users'] as const;
export type SitemapKind = (typeof SITEMAP_KINDS)[number];
export type SitemapItem = { id: number; url: string; updatedAt: string };
export type SitemapPage = { kind: SitemapKind; page: number; items: SitemapItem[] };

export function siteUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').href;
}

/** Status/role filtering belongs to Spring. Accept only canonical URLs for the requested kind here. */
export function sitemapEntries(kind: SitemapKind, items: SitemapItem[]): MetadataRoute.Sitemap {
  const pattern = kind === 'users' ? /^\/u\/[^/]+$/ : new RegExp(`^/${kind}/[0-9]+$`);
  const origin = new URL(siteUrl('/')).origin;
  return items.map((item) => {
    const url = new URL(item.url, origin);
    if (url.origin !== origin || url.username || url.password || !pattern.test(url.pathname)) {
      throw new Error(`Invalid ${kind} sitemap URL`);
    }
    url.search = '';
    url.hash = '';
    return { url: url.href, lastModified: item.updatedAt };
  });
}

export function staticSitemap(): MetadataRoute.Sitemap {
  return [
    '/',
    '/feed',
    '/recruits',
    '/legal/terms',
    '/legal/privacy',
    '/legal/community',
    '/legal/recruiter-terms',
  ].map((path) => ({ url: siteUrl(path) }));
}
