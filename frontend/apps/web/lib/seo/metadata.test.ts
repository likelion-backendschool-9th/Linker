import { buildMetadata, canonicalPath } from './metadata';

describe('canonicalPath', () => {
  it('drops overlay, filter and share params', () => {
    expect(canonicalPath('/posts/1?from=share&overlay=report&oid=3')).toBe('/posts/1');
    expect(canonicalPath('/recruits#top')).toBe('/recruits');
  });
});

describe('buildMetadata', () => {
  it('is noindex unless the page opts in', () => {
    expect(buildMetadata({ title: '채팅' }).robots).toEqual({ index: false, follow: true });
    expect(buildMetadata({ title: '홈', path: '/feed', indexable: true }).robots).toEqual({
      index: true,
      follow: true,
    });
  });

  it('uses the stripped path for canonical and og:url', () => {
    const metadata = buildMetadata({ title: '게시물', path: '/posts/1?from=share' });
    expect(metadata.alternates?.canonical).toBe('/posts/1');
    expect(metadata.openGraph?.url).toBe('/posts/1');
  });
});
