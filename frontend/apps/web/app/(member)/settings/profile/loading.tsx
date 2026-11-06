import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function EditProfileLoading() {
  return (
    <PageFrame title="프로필 불러오는 중" variant="stack">
      <section aria-label="프로필 불러오는 중">
        <Skeleton />
        <Skeleton />
      </section>
    </PageFrame>
  );
}
