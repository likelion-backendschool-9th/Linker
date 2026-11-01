import { buildMetadata } from '@/lib/seo/metadata';

import { AdminUsersView } from './_components/admin-users-view';

export const metadata = {
  ...buildMetadata({ title: '운영 · 회원 관리', path: '/admin/users' }),
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
