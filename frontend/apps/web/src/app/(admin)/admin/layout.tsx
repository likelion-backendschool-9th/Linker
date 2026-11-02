import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { PATHNAME_HEADER } from '@/lib/auth/proxy-paths';

import { AdminOtpGate } from './reports/_components/admin-otp-gate';

export default async function AdminOperationsLayout({ children }: { children: ReactNode }) {
  if ((await headers()).get(PATHNAME_HEADER) === '/admin') redirect('/admin/reports');
  return <AdminOtpGate>{children}</AdminOtpGate>;
}
