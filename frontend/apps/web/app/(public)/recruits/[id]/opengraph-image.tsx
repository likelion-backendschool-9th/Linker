import { ImageResponse } from 'next/og';

import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';

import { recruitDetailOptions } from './_lib/detail-queries';
import { recruitSummary } from './_lib/recruit-summary';

export const alt = 'Linker 모집 글';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Blueprint §8-3: title, remaining roles, D-n. Defaults when the post is gone. */
export default async function Image({ params }: PageProps<'/recruits/[id]'>) {
  const { id } = await params;
  let title = 'Linker';
  let summary = '개발자 팀 모집';

  if (/^\d+$/.test(id)) {
    try {
      const session = await getSession();
      const recruit = await getQueryClient().fetchQuery(
        recruitDetailOptions(session?.login ?? null, id),
      );
      title = recruit.title;
      summary = recruitSummary(recruit);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 64,
          backgroundColor: '#ffffff',
          color: '#111827',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: '#98a3b4' }}>Linker · 모집</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 32, color: '#4b5563' }}>{summary}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
