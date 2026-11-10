import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { buildMetadata } from '@/lib/seo/metadata';

import { LegalDocument } from './_components/legal-document/LegalDocument';

type LegalDocumentData = {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  body: string;
};
type LegalDocumentLink = Pick<LegalDocumentData, 'slug' | 'title' | 'version' | 'effectiveDate'>;

/** Slugs supported by LegalController and the current legal-document fixture. */
const LEGAL_SLUGS = ['terms', 'privacy', 'community', 'recruiter-terms'] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

const getLegalDocument = cache((slug: string) =>
  apiFetch<LegalDocumentData>(`/api/v1/public/legal-documents/${encodeURIComponent(slug)}`),
);

const getLegalDocumentList = cache(() =>
  apiFetch<LegalDocumentLink[]>('/api/v1/public/legal-documents'),
);

export async function generateMetadata({ params }: PageProps<'/legal/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  try {
    const document = await getLegalDocument(slug);
    return buildMetadata({ title: document.title, path: `/legal/${slug}`, indexable: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function LegalDocumentPage({ params }: PageProps<'/legal/[slug]'>) {
  const { slug } = await params;
  let document: LegalDocumentData;
  try {
    document = await getLegalDocument(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const documents = await getLegalDocumentList();
  return (
    <PageFrame title={document.title} variant="stack" backHref="/feed" bottomTabs={false}>
      <LegalDocument document={document} documents={documents} />
    </PageFrame>
  );
}
