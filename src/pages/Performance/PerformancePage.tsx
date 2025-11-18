import { Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ScopeBar } from '../../components/Scope/ScopeBar';
import { EmployeePerformancePage } from './EmployeePerformancePage';
import { OwnerPerformancePage } from './OwnerPerformancePage';

export function PerformancePage() {
  const { membership } = useAuth();

  // Check if user is owner/admin/hr/manager (management roles) or employee
  const isManagement = membership?.role && ['owner', 'admin', 'hr', 'manager'].includes(membership.role);

  return (
    <>
      {isManagement && <ScopeBar />}
      {isManagement ? <OwnerPerformancePage /> : <EmployeePerformancePage />}
    </>
  );
}
