import { TeamSetupFrame } from './_components/team-setup-frame/TeamSetupFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <TeamSetupFrame>
      <Skeleton variant="card" />
    </TeamSetupFrame>
  );
}
