import { getTeam } from './_lib/get-team';

/**
 * Team pages 11–15 (and 09). Members only: anyone else gets "삭제되었거나 볼 수 없는 콘텐츠예요" (404).
 * The team header and menu live in `TeamFrame`, inside each page's `PageFrame` landmarks.
 */
export default async function TeamLayout({ params, children }: LayoutProps<'/teams/[id]'>) {
  const { id } = await params;
  await getTeam(id);
  return children;
}
