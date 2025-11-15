import { useAuth } from '../../contexts/AuthContext';
import { OwnerExpensesPage } from './OwnerExpensesPage';
import { EmployeeExpensesPage } from './EmployeeExpensesPage';

export function ExpensesPage() {
  const { role } = useAuth();

  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || role === 'hr' || role === 'finance';

  return isOwnerOrAdmin ? <OwnerExpensesPage /> : <EmployeeExpensesPage />;
}
