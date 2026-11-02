import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditProfileLoading() {
  return (
    <PageFrame title="프로필 불러오는 중" variant="stack">
      <section aria-label="프로필 불러오는 중">
<LoadingIndicator label="프로필 불러오는 중" labelHidden variant="block">
  <Skeleton />
  <Skeleton />
</LoadingIndicator>
</section>
    </PageFrame>
  );
}
