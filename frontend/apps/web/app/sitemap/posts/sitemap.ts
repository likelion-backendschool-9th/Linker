import { pagedSitemap, sitemapIds } from '@/lib/api/sitemap';

export const revalidate = 86400;

export function generateSitemaps() {
  return sitemapIds('posts');
}

export default async function sitemap({ id }: { id: Promise<string> }) {
  return pagedSitemap('posts', await id);
}
