import { AppShell } from '@/components/layout/app-shell';
import { enforceAccess } from '@/lib/auth/enforce-access';

// Developers (and operators) only; recruiters → /feed (blueprint §3-2)
export default async function DeveloperLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AppShell>{children}</AppShell>;
}
