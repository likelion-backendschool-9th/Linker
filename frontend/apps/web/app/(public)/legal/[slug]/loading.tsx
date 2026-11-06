import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function LegalDocumentLoading() {
  return (
    <PageFrame title="문서 불러오는 중" variant="stack" bottomTabs={false}>
      <Skeleton variant="line" count={10} />
    </PageFrame>
  );
}
