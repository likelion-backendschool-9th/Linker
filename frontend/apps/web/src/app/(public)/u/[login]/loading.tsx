import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <PageFrame title="프로필 불러오는 중">
      <section aria-label="프로필 불러오는 중">
        <Skeleton />
        <Skeleton />
      </section>
    </PageFrame>
  );
}
