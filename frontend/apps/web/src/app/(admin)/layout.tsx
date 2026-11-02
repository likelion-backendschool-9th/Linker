import type { Metadata } from 'next';

import { AdminShell } from '@/components/layout/admin-shell';
import { enforceAccess } from '@/lib/auth/enforce-access';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Operators only; everyone else gets 404 (blueprint §3-2). The OTP gate and 30-min idle logout
// go in (admin)/admin/layout.tsx with page 25.
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  await enforceAccess();
  return <AdminShell>{children}</AdminShell>;
}
