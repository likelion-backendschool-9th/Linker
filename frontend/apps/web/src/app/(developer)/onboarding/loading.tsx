import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function OnboardingLoading() {
  return (
    <PageFrame title="프로필 설정" variant="stack" bottomTabs={false}>
      <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
        <Skeleton variant="line" count={6} />
      </LoadingIndicator>
    </PageFrame>
  );
}
