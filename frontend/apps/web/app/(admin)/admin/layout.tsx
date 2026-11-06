import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { PATHNAME_HEADER } from '@/lib/auth/proxy-paths';

export default async function AdminOperationsLayout({ children }: { children: ReactNode }) {
  if ((await headers()).get(PATHNAME_HEADER) === '/admin') redirect('/admin/reports');
  return children;
}
