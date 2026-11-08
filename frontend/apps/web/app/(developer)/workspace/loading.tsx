import { WorkspaceFrame } from './_components/workspace-frame/WorkspaceFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <WorkspaceFrame>
      <Skeleton variant="card" count={3} />
    </WorkspaceFrame>
  );
}
