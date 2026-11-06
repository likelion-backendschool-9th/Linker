import { buildMetadata } from '@/lib/seo/metadata';

import { AdminAuditView } from './_components/admin-audit-view/AdminAuditView';

export const metadata = {
  ...buildMetadata({ title: '운영 · 조치 기록', path: '/admin/audit' }),
  robots: { index: false, follow: false },
};

export default function AdminAuditPage() {
  return <AdminAuditView />;
}
