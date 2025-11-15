import { useAuth } from '../../contexts/AuthContext';
import { OwnerPayrollPage } from './OwnerPayrollPage';
import { EmployeePayrollPage } from './EmployeePayrollPage';

export function PayrollPage() {
  const { organization, membership } = useAuth();

  // Check if user is owner/admin/hr or regular employee
  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin' || membership?.role === 'hr';

  if (isOwnerOrAdmin) {
    return <OwnerPayrollPage />;
  }

  return <EmployeePayrollPage />;
}
