import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function ProfileLoading() {
  return (
    <PageFrame title="프로필 불러오는 중" variant="stack" backHref="/feed" bottomTabs={false}>
      <section aria-label="프로필 불러오는 중">
        <Skeleton />
        <Skeleton />
      </section>
    </PageFrame>
  );
}
