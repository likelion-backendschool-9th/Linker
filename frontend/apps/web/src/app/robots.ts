import type { MetadataRoute } from 'next';

// Blueprint §8-1: allow all except /admin and /api/.
// The `sitemap` field is added with sitemap.ts and SitemapController (WBS 00, B, D10).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
  };
}
