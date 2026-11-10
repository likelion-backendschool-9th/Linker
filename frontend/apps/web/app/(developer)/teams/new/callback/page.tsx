import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { buildMetadata } from '@/lib/seo/metadata';
import { TeamCallbackView } from '../_components/team-callback-view/TeamCallbackView';

export const metadata = buildMetadata({ title: 'GitHub 연결 확인' });

export default function TeamCallbackPage() {
  return (
    <PageFrame title="GitHub 연결 확인" variant="stack" backHref="/teams/new" bottomTabs={false}>
      <TeamCallbackView />
    </PageFrame>
  );
}
