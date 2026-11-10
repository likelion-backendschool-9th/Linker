import { buildMetadata } from '@/lib/seo/metadata';

import { AdminAuditAccess } from './_components/admin-audit-access/AdminAuditAccess';

export const metadata = {
  ...buildMetadata({ title: '운영 · 운영 로그', path: '/admin/audit' }),
  robots: { index: false, follow: false },
};

export default function AdminAuditPage() {
  return <AdminAuditAccess />;
}
