import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Users, Briefcase, Mail, Phone, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AddEmployeeModal } from '../../components/Employees/AddEmployeeModal';
import { EditEmployeeModal } from '../../components/Employees/EditEmployeeModal';
import { ViewEmployeeModal } from '../../components/Employees/ViewEmployeeModal';
import { DeleteConfirmModal } from '../../components/Employees/DeleteConfirmModal';
import { useAuth } from '../../contexts/AuthContext';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code?: string | null;
  company_email?: string | null;
  mobile_number?: string | null;
  employment_status: string;
  employment_type: string;
  date_of_joining: string;
  department_id?: string | null;
  designation_id?: string | null;
  branch_id?: string | null;
  created_at?: string;
  [key: string]: any;
  departments?: { name: string } | null;
  designations?: { title: string } | null;
};

export function EmployeesPage() {
  const { organization, permissions } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      loadEmployees();
      loadMasterData();
    }
  }, [organization, statusFilter]);

  const loadEmployees = async () => {
    if (!organization?.id) return;

    try {
      // Use explicit relationship names to avoid PostgREST PGRST201 ambiguity
      // employees has department_id -> departments(id) and designation_id -> designations(id)
      let query = supabase
        .from('employees')
        .select(`
          *,
          departments:departments!employees_department_id_fkey(name),
          designations:designations!employees_designation_id_fkey(title)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('employment_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    if (!organization?.id) return;

    try {
      const [deptData, desigData, branchData] = await Promise.all([
        supabase.from('departments').select('*').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('designations').select('*').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('branches').select('*').eq('organization_id', organization.id).eq('is_active', true)
      ]);

      setDepartments(deptData.data || []);
      setDesignations(desigData.data || []);
      setBranches(branchData.data || []);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      loadEmployees();
      setShowDeleteConfirm(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.company_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200',
      probation: 'bg-blue-100 text-blue-700 ring-2 ring-blue-200',
      resigned: 'bg-red-100 text-red-700 ring-2 ring-red-200',
      terminated: 'bg-red-100 text-red-700 ring-2 ring-red-200',
      on_hold: 'bg-amber-100 text-amber-700 ring-2 ring-amber-200',
    };
    return styles[status as keyof typeof styles] || styles.active;
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      full_time: 'bg-blue-100 text-blue-700',
      part_time: 'bg-violet-100 text-violet-700',
      contract: 'bg-amber-100 text-amber-700',
      intern: 'bg-pink-100 text-pink-700',
    };
    return styles[type as keyof typeof styles] || styles.full_time;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {(departments.length === 0 || designations.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <p className="font-semibold mb-1">Setup needed: Departments and Designations</p>
          <p className="text-sm">Your organization doesn't have any departments and/or designations yet. Create them from Settings before adding employees, or select them later by editing the employee.</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            Employees
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Manage your team members
          </p>
        </div>
        {permissions.addEmployee && (
          <button
            onClick={() => setShowAddModal(true)}
            className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
            Add Employee
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Employees"
          value={employees.length}
          gradient="from-blue-500 to-blue-600"
          icon={Users}
        />
        <StatsCard
          title="Active"
          value={employees.filter(e => e.employment_status === 'active').length}
          gradient="from-emerald-500 to-emerald-600"
          icon={Briefcase}
        />
        <StatsCard
          title="Inactive"
          value={employees.filter(e => e.employment_status !== 'active').length}
          gradient="from-amber-500 to-amber-600"
          icon={Calendar}
        />
        <StatsCard
          title="Departments"
          value={departments.length}
          gradient="from-violet-500 to-violet-600"
          icon={Briefcase}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employees by name, code, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium text-lg">No employees found</p>
            <p className="text-sm text-slate-400 mt-2">
              {searchTerm ? 'Try adjusting your search' : 'Add your first employee to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee, index) => (
              <div
                key={employee.id}
                className="group relative bg-gradient-to-br from-slate-50 to-white p-5 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {employee.first_name[0]}{employee.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {employee.first_name} {employee.last_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{employee.employee_code}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{employee.designations?.title || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{employee.company_email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{employee.mobile_number || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      Joined {new Date(employee.date_of_joining).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusBadge(employee.employment_status)}`}>
                    {employee.employment_status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadge(employee.employment_type)}`}>
                    {employee.employment_type.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-200">
                  <button 
                    onClick={() => handleView(employee)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  {permissions.editEmployee && (
                    <button 
                      onClick={() => handleEdit(employee)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {permissions.deleteEmployee && (
                    <button 
                      onClick={() => handleDelete(employee)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadEmployees();
          }}
          departments={departments}
          designations={designations}
          branches={branches}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
          departments={departments}
          designations={designations}
          branches={branches}
        />
      )}

      {showViewModal && selectedEmployee && (
        <ViewEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowViewModal(false);
            setSelectedEmployee(null);
          }}
          departments={departments}
          designations={designations}
          branches={branches}
        />
      )}

      {showDeleteConfirm && selectedEmployee && (
        <DeleteConfirmModal
          employee={selectedEmployee}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedEmployee(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function StatsCard({ title, value, gradient, icon: Icon }: { title: string; value: number; gradient: string; icon: any }) {
  return (
    <div className="group relative bg-white rounded-xl shadow-md border border-slate-200 p-5 hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}
