import { AdminOtpGate } from './_components/admin-otp-gate/AdminOtpGate';
import { AdminReportsView } from './_components/admin-reports-view/AdminReportsView';

export default function AdminReportsPage() {
  return (
    <AdminOtpGate>
      <AdminReportsView />
    </AdminOtpGate>
  );
}
