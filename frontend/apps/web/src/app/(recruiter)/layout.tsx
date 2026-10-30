import { AppShell } from '@/components/layout/app-shell';
import { enforceAccess } from '@/lib/auth/enforce-access';

// Recruiters only; developers → /feed (blueprint §3-2)
export default async function RecruiterLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AppShell>{children}</AppShell>;
}
