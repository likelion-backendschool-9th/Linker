import { AppShell } from '@/components/layout/app-shell/AppShell';
import { enforceAccess } from '@/lib/auth/enforce-access';

// Developers + recruiters; role variants of one URL branch inside with _views/ (blueprint §3-2, §4-4)
export default async function MemberLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AppShell>{children}</AppShell>;
}
