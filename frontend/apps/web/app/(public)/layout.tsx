import { AppShell } from '@/components/layout/app-shell/AppShell';
import { enforceAccess } from '@/lib/auth/enforce-access';

// Anyone reads; guest actions go through useRequireLogin() (blueprint §3-2).
// Re-check so an opaque session still sends an unfinished developer to /onboarding (blueprint §4-2).
export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AppShell>{children}</AppShell>;
}
