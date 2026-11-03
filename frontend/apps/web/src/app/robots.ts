import type { MetadataRoute } from 'next';

import { sitemapIds } from '@/lib/api/sitemap';
import { SITEMAP_KINDS, siteUrl } from '@/lib/seo/sitemap';

// Blueprint §8-1: allow all except /admin and /api/.
export const revalidate = 86400;
// Partition discovery runs at request time; its cookie-less API responses still cache for one day.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const groups = await Promise.all(
    SITEMAP_KINDS.map(async (kind) =>
      (await sitemapIds(kind)).map(({ id }) => siteUrl(`/sitemap/${kind}/${id}.xml`)),
    ),
  );
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: [siteUrl('/sitemap.xml'), ...groups.flat()],
  };
}
