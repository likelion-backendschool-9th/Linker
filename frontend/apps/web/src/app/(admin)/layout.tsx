import type { Metadata } from 'next';

import { AdminShell } from '@/components/layout/admin-shell';
import { enforceAccess } from '@/lib/auth/enforce-access';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Operators only; everyone else gets 404 (blueprint §3-2). The server closes an operator
// session after 30 minutes without a request. OTP stays a later step.
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AdminShell>{children}</AdminShell>;
}
