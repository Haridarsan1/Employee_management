import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Department { id: string; name: string }
interface Employee { id: string; first_name: string; last_name: string; employee_code: string; department_id: string }

interface ScopeContextType {
  departments: Department[];
  employees: Employee[];
  selectedDepartmentId: string | null;
  selectedEmployeeId: string | null;
  setDepartment: (id: string | null) => void;
  setEmployee: (id: string | null) => void;
  clearScope: () => void;
  employeesInSelectedDept: Employee[];
}

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { organization, membership } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Persist scope by org
  const storageKey = useMemo(() => organization?.id ? `scope:${organization.id}` : undefined, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;
    // restore persisted
    if (storageKey) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSelectedDepartmentId(parsed.departmentId ?? null);
          setSelectedEmployeeId(parsed.employeeId ?? null);
        } catch {}
      }
    }
    // load deps/employees
    const load = async () => {
      const [{ data: deptData }, { data: empData }] = await Promise.all([
        supabase.from('departments').select('id,name').eq('organization_id', organization.id).order('name'),
        supabase.from('employees').select('id,first_name,last_name,employee_code,department_id').eq('organization_id', organization.id).eq('employment_status','active').order('first_name')
      ]);
      setDepartments(deptData || []);
      setEmployees(empData || []);
    };
    load();
  }, [organization?.id, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify({ departmentId: selectedDepartmentId, employeeId: selectedEmployeeId }));
  }, [storageKey, selectedDepartmentId, selectedEmployeeId]);

  // If not owner/admin-ish, clear scope (employees see only own data)
  useEffect(() => {
    const role = membership?.role;
    const isOwnerOrAdmin = role && ['owner','admin','hr','manager'].includes(role);
    if (!isOwnerOrAdmin) {
      setSelectedDepartmentId(null);
      setSelectedEmployeeId(null);
    }
  }, [membership?.role]);

  const employeesInSelectedDept = useMemo(() => {
    return selectedDepartmentId ? employees.filter(e => e.department_id === selectedDepartmentId) : employees;
  }, [employees, selectedDepartmentId]);

  const setDepartment = (id: string | null) => {
    setSelectedDepartmentId(id);
    // If employee not in dept, reset employee
    if (id && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp && emp.department_id !== id) setSelectedEmployeeId(null);
    }
  };
  const setEmployee = (id: string | null) => setSelectedEmployeeId(id);
  const clearScope = () => { setSelectedDepartmentId(null); setSelectedEmployeeId(null); };

  return (
    <ScopeContext.Provider value={{ departments, employees, selectedDepartmentId, selectedEmployeeId, setDepartment, setEmployee, clearScope, employeesInSelectedDept }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within ScopeProvider');
  return ctx;
}
