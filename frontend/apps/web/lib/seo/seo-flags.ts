/**
 * Pages search engines may index (04 POL-A-9, blueprint §8-1). Everything else stays `noindex`
 * (root default). Pages opt in with `buildMetadata({ indexable: true })`; this list documents who may.
 */
export const INDEXABLE = {
  '01': '/',
  '03': '/legal/[slug]',
  '04': '/users/[login] (developer only)',
  '19': '/recruits',
  '21': '/recruits/[id] (closed too; 404 when deleted)',
  '23': '/posts/[id]',
  '24': '/feed',
} as const;

export const SITE_NAME = 'Linker';
export const SITE_DESCRIPTION =
  '팀을 찾고, GitHub 조직으로 함께 일하고, 완성한 작업물을 보여주는 개발자 소셜 서비스';
export const DEFAULT_OG_IMAGE = '/og-default.png';
