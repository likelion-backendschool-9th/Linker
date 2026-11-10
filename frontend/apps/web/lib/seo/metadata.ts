import type { Metadata } from 'next';

import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION } from './seo-flags';

type BuildMetadataInput = {
  title: string;
  description?: string;
  /** Absolute or root-relative; 1200×630 */
  image?: string;
  /** Page path for canonical and og:url. Query (overlay, oid, filters, `from=share`) is always dropped. */
  path?: string;
  /** Only the pages in `INDEXABLE` set this */
  indexable?: boolean;
};

/** Removes the query and hash so canonical / og:url never carry overlay, filter or share params (blueprint §8-3). */
export function canonicalPath(path: string): string {
  const end = path.search(/[?#]/);
  return end === -1 ? path : path.slice(0, end);
}

/** Every page's `metadata` / `generateMetadata` goes through here (blueprint §8-3). */
export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  path,
  indexable = false,
}: BuildMetadataInput): Metadata {
  const url = path ? canonicalPath(path) : undefined;
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}
