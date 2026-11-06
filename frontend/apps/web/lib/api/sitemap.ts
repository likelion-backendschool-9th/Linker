import 'server-only';

import { cache } from 'react';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { z } from 'zod';

import { SITEMAP } from '@/lib/policy';
import { SITEMAP_KINDS, sitemapEntries, type SitemapKind } from '@/lib/seo/sitemap';

import { apiFetch } from './api-fetch';
import { fetchPublicCached } from './public-cached';

const sitemapPageSchema = z.object({
  kind: z.enum(SITEMAP_KINDS),
  page: z.number().int().positive(),
  items: z
    .array(
      z.object({ id: z.number().int().positive(), url: z.string(), updatedAt: z.iso.datetime() }),
    )
    .max(SITEMAP.pageSize),
});

/** Existing WBS 00 contract, pending generated OpenAPI types; never forward session cookies. */
export const getSitemapPage = cache(async (kind: SitemapKind, page: number) => {
  const path = `/api/v1/public/sitemap/${kind}?page=${page}` as const;
  const raw =
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
      ? await apiFetch<unknown>(path, { credentials: 'omit' })
      : await fetchPublicCached<unknown>(path, { revalidate: 86_400, tags: [`sitemap:${kind}`] });
  const result = sitemapPageSchema.parse(raw);
  if (result.kind !== kind || result.page !== page) throw new Error('Mismatched sitemap page');
  return result;
});

/** No count endpoint is needed: a short page ends the current kind, including an empty first page. */
export const sitemapIds = cache(async (kind: SitemapKind): Promise<{ id: number }[]> => {
  // Discover on first request with ISR, so building the web bundle needs no running Spring server.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return [];
  const ids: { id: number }[] = [];
  for (let page = 1; ; page++) {
    const result = await getSitemapPage(kind, page);
    if (result.items.length || page === 1) ids.push({ id: page - 1 });
    if (result.items.length < SITEMAP.pageSize) return ids;
  }
});

export async function pagedSitemap(kind: SitemapKind, id: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(id) || !Number.isSafeInteger(Number(id) + 1)) {
    const { notFound } = await import('next/navigation');
    return notFound();
  }
  const result = await getSitemapPage(kind, Number(id) + 1);
  return sitemapEntries(kind, result.items);
}
