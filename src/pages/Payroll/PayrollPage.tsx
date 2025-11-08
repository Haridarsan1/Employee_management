import { useState, useEffect } from 'react';
import { DollarSign, Calculator, FileText, Calendar, Users, TrendingUp, Eye, Edit, Plus, Filter, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type PayrollRecord = Database['public']['Tables']['payroll_records']['Row'] & {
  employees?: {
    first_name: string;
    last_name: string;
    employee_code: string;
    departments?: { name: string };
    designations?: { title: string };
  };
};

type SalaryComponent = Database['public']['Tables']['salary_components']['Row'];

export function PayrollPage() {
  const { organization, membership } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'components' | 'generate'>('overview');
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (organization?.id) {
      loadPayrollData();
      loadEmployees();
    }
  }, [organization, selectedMonth]);

  const loadPayrollData = async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      // Load payroll records
      const { data: records, error: recordsError } = await supabase
        .from('payroll_records')
        .select(`
          *,
          employees (
            first_name,
            last_name,
            employee_code,
            departments (name),
            designations (title)
          )
        `)
        .eq('organization_id', organization.id)
        .like('payroll_month', `${selectedMonth}%`)
        .order('created_at', { ascending: false });

      if (recordsError) throw recordsError;
      setPayrollRecords(records || []);

      // Load salary components
      const { data: components, error: componentsError } = await supabase
        .from('salary_components')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (componentsError) throw componentsError;
      setSalaryComponents(components || []);
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          employee_code,
          basic_salary,
          ctc_annual,
          departments (name),
          designations (title)
        `)
        .eq('organization_id', organization.id)
        .eq('employment_status', 'active');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const generatePayroll = async (employeeIds: string[]) => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const payrollMonth = selectedMonth;
      const generatedRecords = [];

      for (const employeeId of employeeIds) {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) continue;

        // Calculate salary components
        const basicSalary = employee.basic_salary || 0;
        const hra = basicSalary * 0.4; // 40% of basic
        const conveyance = Math.min(19200, basicSalary * 0.1); // 10% of basic, max 19,200
        const lta = basicSalary * 0.0833; // 1 month basic per year
        const medical = 5000; // Standard medical allowance
        const totalEarnings = basicSalary + hra + conveyance + lta + medical;

        // Calculate deductions
        const pf = basicSalary * 0.12; // 12% of basic
        const professionalTax = 235; // Monthly professional tax
        const incomeTax = calculateIncomeTax(totalEarnings * 12) / 12; // Monthly income tax
        const totalDeductions = pf + professionalTax + incomeTax;

        const netSalary = totalEarnings - totalDeductions;

        // Create payroll record
        const { data: record, error: recordError } = await supabase
          .from('payroll_records')
          .insert({
            organization_id: organization.id,
            employee_id: employeeId,
            payroll_month: payrollMonth,
            basic_salary: basicSalary,
            hra: hra,
            conveyance: conveyance,
            lta: lta,
            medical: medical,
            total_earnings: totalEarnings,
            pf: pf,
            professional_tax: professionalTax,
            income_tax: incomeTax,
            total_deductions: totalDeductions,
            net_salary: netSalary,
            status: 'draft'
          })
          .select()
          .single();

        if (recordError) throw recordError;
        generatedRecords.push(record);
      }

      await loadPayrollData();
      setShowGenerateModal(false);
    } catch (error) {
      console.error('Error generating payroll:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateIncomeTax = (annualSalary: number) => {
    // Simplified Indian income tax calculation
    if (annualSalary <= 250000) return 0;
    if (annualSalary <= 500000) return (annualSalary - 250000) * 0.05;
    if (annualSalary <= 1000000) return 12500 + (annualSalary - 500000) * 0.2;
    return 12500 + 100000 + (annualSalary - 1000000) * 0.3;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      processed: 'bg-blue-100 text-blue-700',
      approved: 'bg-emerald-100 text-emerald-700',
      paid: 'bg-green-100 text-green-700',
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  const totalPayroll = payrollRecords.reduce((sum, record) => sum + (record.net_salary || 0), 0);
  const totalEmployees = payrollRecords.length;
  const averageSalary = totalEmployees > 0 ? totalPayroll / totalEmployees : 0;

  if (loading && payrollRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            Payroll Management
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-500" />
            Manage employee salaries and payroll processing
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5" />
            Generate Payroll
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
        <Calendar className="h-5 w-5 text-slate-500" />
        <label className="font-medium text-slate-700">Payroll Month:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'records', label: 'Payroll Records', icon: FileText },
          { id: 'components', label: 'Salary Components', icon: Calculator },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Payroll</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPayroll)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Employees Paid</p>
                <p className="text-2xl font-bold text-slate-900">{totalEmployees}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Average Salary</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(averageSalary)}</p>
              </div>
              <div className="p-3 bg-violet-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-slate-900">
                  {payrollRecords.filter(r => r.status === 'draft').length}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Records Tab */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Payroll Records</h2>
          </div>
          <div className="p-6">
            {payrollRecords.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium text-lg">No payroll records found</p>
                <p className="text-sm text-slate-400 mt-2">
                  Generate payroll for this month to get started
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-700">Department</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-700">Basic Salary</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-700">Net Salary</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-700">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRecords.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {record.employees?.first_name} {record.employees?.last_name}
                            </p>
                            <p className="text-sm text-slate-500">{record.employees?.employee_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {record.employees?.departments?.name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900">
                          {formatCurrency(record.basic_salary)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          {formatCurrency(record.net_salary)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusBadge(record.status)}`}>
                            {record.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                              <Eye className="h-4 w-4 text-slate-600" />
                            </button>
                            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                              <Download className="h-4 w-4 text-slate-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Salary Components Tab */}
      {activeTab === 'components' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Salary Components</h2>
          </div>
          <div className="p-6">
            {salaryComponents.length === 0 ? (
              <div className="text-center py-12">
                <Calculator className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium text-lg">No salary components configured</p>
                <p className="text-sm text-slate-400 mt-2">
                  Configure salary components to customize payroll calculations
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {salaryComponents.map((component) => (
                  <div key={component.id} className="p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-900">{component.component_name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        component.component_type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {component.component_type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{component.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Amount:</span>
                      <span className="font-medium">{formatCurrency(component.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Payroll Modal */}
      {showGenerateModal && (
        <GeneratePayrollModal
          employees={employees}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={generatePayroll}
          loading={loading}
        />
      )}
    </div>
  );
}

function GeneratePayrollModal({ employees, onClose, onGenerate, loading }: {
  employees: any[];
  onClose: () => void;
  onGenerate: (employeeIds: string[]) => void;
  loading: boolean;
}) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const handleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.id));
    }
  };

  const handleSubmit = () => {
    if (selectedEmployees.length > 0) {
      onGenerate(selectedEmployees);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Plus className="h-6 w-6 text-green-600" />
            Generate Payroll
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Select Employees</h3>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedEmployees.length === employees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className={`flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0 ${
                    selectedEmployees.includes(employee.id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee.id]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {employee.employee_code} • {employee.departments?.name} • {employee.designations?.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(employee.basic_salary || 0)}
                    </p>
                    <p className="text-sm text-slate-500">Basic Salary</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              {selectedEmployees.length} of {employees.length} employees selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedEmployees.length === 0 || loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate Payroll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayrollStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <DollarSign className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
