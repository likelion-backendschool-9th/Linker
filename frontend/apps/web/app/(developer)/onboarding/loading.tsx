import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function OnboardingLoading() {
  return (
    <PageFrame title="약관 동의" variant="stack" backHref="/feed" bottomTabs={false}>
      <Skeleton variant="line" count={6} />
    </PageFrame>
  );
}
