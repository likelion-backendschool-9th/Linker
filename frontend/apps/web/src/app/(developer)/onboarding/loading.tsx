import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function OnboardingLoading() {
  return (
    <PageFrame title="프로필 설정" variant="stack" bottomTabs={false}>
      <Skeleton variant="line" count={6} />
    </PageFrame>
  );
}
