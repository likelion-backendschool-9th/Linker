import { EntryShell } from '@/components/layout/entry-shell/EntryShell';
import { enforceAccess } from '@/lib/auth/enforce-access';

// Before login: start, callbacks, recruiter sign-up/login/reset. Logged in → /feed except callbacks (blueprint §3-2)
export default async function AuthLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <EntryShell>{children}</EntryShell>;
}
