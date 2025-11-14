import { useMemo } from 'react';
import { Users, Building2, X } from 'lucide-react';
import { useScope } from '../../contexts/ScopeContext';
import { useAuth } from '../../contexts/AuthContext';

export function ScopeBar() {
  const { departments, employeesInSelectedDept, selectedDepartmentId, selectedEmployeeId, setDepartment, setEmployee, clearScope } = useScope();
  const { membership } = useAuth();
  const isOwnerOrAdmin = membership?.role && ['owner','admin','hr','manager'].includes(membership.role);
  if (!isOwnerOrAdmin) return null;

  const employeeOptions = useMemo(() => employeesInSelectedDept, [employeesInSelectedDept]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white/60">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-500" />
        <select
          value={selectedDepartmentId || ''}
          onChange={(e) => setDepartment(e.target.value || null)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <select
          value={selectedEmployeeId || ''}
          onChange={(e) => setEmployee(e.target.value || null)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Employees</option>
          {employeeOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name} ({e.employee_code})
            </option>
          ))}
        </select>
      </div>

      {(selectedDepartmentId || selectedEmployeeId) && (
        <button onClick={clearScope} className="ml-auto inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm">
          <X className="h-4 w-4" /> Clear
        </button>
      )}
    </div>
  );
}
