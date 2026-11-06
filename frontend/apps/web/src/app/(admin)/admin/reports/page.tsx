import { AdminOtpGate } from './_components/admin-otp-gate';
import { AdminReportsView } from './_components/admin-reports-view';

export default function AdminReportsPage() {
  return (
    <AdminOtpGate>
      <AdminReportsView />
    </AdminOtpGate>
  );
}
