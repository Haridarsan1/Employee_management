import { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, Users, TrendingUp, Download, FileText, 
  CheckCircle, Clock, Plus, Settings, Eye, RefreshCw, Filter, X 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PayrollCycle {
  id: string;
  month: number;
  year: number;
  from_date: string;
  to_date: string;
  total_employees: number;
  total_gross_salary: number;
  total_deductions: number;
  total_net_salary: number;
  status: string;
  processed_at: string | null;
}

interface Payslip {
  id: string;
  payroll_cycle_id: string;
  employee_id: string;
  working_days: number;
  present_days: number;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  earnings: any;
  deductions: any;
  payment_status: string;
  payment_date: string | null;
  employees: {
    first_name: string;
    last_name: string;
    employee_code: string;
    company_email: string;
    departments: { name: string } | null;
    designations: { title: string } | null;
  };
}

interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: 'earning' | 'deduction';
  is_active: boolean;
  display_order: number;
}

export function OwnerPayrollPage() {
  const { organization } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'cycles' | 'components'>('overview');
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PayrollCycle | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [componentForm, setComponentForm] = useState({
    name: '',
    code: '',
    type: 'earning' as 'earning' | 'deduction',
    is_taxable: true
  });

  useEffect(() => {
    if (organization?.id) {
      loadCycles();
      loadComponents();
    }
  }, [organization]);

  useEffect(() => {
    if (selectedCycle) {
      loadPayslips(selectedCycle.id);
    }
  }, [selectedCycle]);

  const loadCycles = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_cycles')
        .select('*')
        .eq('organization_id', organization.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12);

      if (error) throw error;
      setCycles(data || []);
      if (data && data.length > 0 && !selectedCycle) {
        setSelectedCycle(data[0]);
      }
    } catch (error) {
      console.error('Error loading cycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayslips = async (cycleId: string) => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select(`
          *,
          employees (
            first_name,
            last_name,
            employee_code,
            company_email,
            departments (name),
            designations (title)
          )
        `)
        .eq('payroll_cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayslips(data || []);
    } catch (error) {
      console.error('Error loading payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComponents = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .eq('organization_id', organization.id)
        .order('type', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setComponents(data || []);
    } catch (error) {
      console.error('Error loading components:', error);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const { month, year } = generateForm;
      const fromDate = new Date(year, month - 1, 1);
      const toDate = new Date(year, month, 0);

      const { data, error } = await supabase.rpc('generate_payroll_for_month', {
        p_organization_id: organization.id,
        p_month: month,
        p_year: year,
        p_from_date: fromDate.toISOString().split('T')[0],
        p_to_date: toDate.toISOString().split('T')[0]
      });

      if (error) throw error;
      
      alert(`Payroll generated successfully!\n${data.payslips_generated} payslips created.\nTotal Net: ₹${formatCurrency(data.total_net)}`);
      setShowGenerateModal(false);
      await loadCycles();
    } catch (error: any) {
      console.error('Error generating payroll:', error);
      alert('Failed to generate payroll: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (payslipIds: string[]) => {
    if (!confirm(`Mark ${payslipIds.length} payslip(s) as paid?`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('mark_payslips_paid', {
        p_payslip_ids: payslipIds,
        p_payment_method: 'bank_transfer'
      });

      if (error) throw error;
      alert(`${data} payslip(s) marked as paid`);
      if (selectedCycle) {
        await loadPayslips(selectedCycle.id);
      }
    } catch (error: any) {
      console.error('Error marking paid:', error);
      alert('Failed to mark as paid: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComponent = async () => {
    if (!organization?.id) return;
    if (!componentForm.name || !componentForm.code) {
      alert('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('salary_components')
        .insert({
          organization_id: organization.id,
          name: componentForm.name,
          code: componentForm.code.toUpperCase(),
          type: componentForm.type,
          is_taxable: componentForm.is_taxable,
          is_active: true,
          display_order: components.filter(c => c.type === componentForm.type).length + 1
        });

      if (error) throw error;
      alert('Component added successfully!');
      setShowComponentModal(false);
      setComponentForm({ name: '', code: '', type: 'earning', is_taxable: true });
      await loadComponents();
    } catch (error: any) {
      console.error('Error adding component:', error);
      alert('Failed to add component: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportPayrollCSV = () => {
    if (!selectedCycle || payslips.length === 0) return;
    const headers = ['Employee Code', 'Name', 'Department', 'Designation', 'Gross Salary', 'Deductions', 'Net Salary', 'Status'];
    const rows = payslips.map(p => [
      p.employees.employee_code,
      `${p.employees.first_name} ${p.employees.last_name}`,
      p.employees.departments?.name || '-',
      p.employees.designations?.title || '-',
      p.gross_salary,
      p.total_deductions,
      p.net_salary,
      p.payment_status
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${selectedCycle.year}_${selectedCycle.month}.csv`;
    a.click();
  };

  const downloadPayslip = (payslip: Payslip) => {
    // Simple text-based payslip for now
    const emp = payslip.employees;
    const text = `
PAYSLIP - ${selectedCycle?.month}/${selectedCycle?.year}
===============================================
Employee: ${emp.first_name} ${emp.last_name}
Code: ${emp.employee_code}
Email: ${emp.company_email}
Department: ${emp.departments?.name || '-'}
Designation: ${emp.designations?.title || '-'}

EARNINGS:
${Object.entries(payslip.earnings || {}).map(([k, v]) => `${k}: ₹${v}`).join('\n')}
Total Earnings: ₹${formatCurrency(payslip.total_earnings)}

DEDUCTIONS:
${Object.entries(payslip.deductions || {}).map(([k, v]) => `${k}: ₹${v}`).join('\n')}
Total Deductions: ₹${formatCurrency(payslip.total_deductions)}

NET SALARY: ₹${formatCurrency(payslip.net_salary)}
Status: ${payslip.payment_status}
${payslip.payment_date ? `Paid on: ${new Date(payslip.payment_date).toLocaleDateString()}` : ''}
===============================================
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${emp.employee_code}_${selectedCycle?.month}_${selectedCycle?.year}.txt`;
    a.click();
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '0.00';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      processed: 'bg-blue-100 text-blue-700',
      paid: 'bg-emerald-100 text-emerald-700',
      unpaid: 'bg-amber-100 text-amber-700'
    };
    return colors[status] || colors.draft;
  };

  const totalPayroll = selectedCycle?.total_net_salary || 0;
  const paidCount = payslips.filter(p => p.payment_status === 'paid').length;
  const unpaidCount = payslips.filter(p => p.payment_status === 'unpaid').length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payroll Management</h1>
          <p className="text-slate-500 mt-1">Manage employee salaries and payslips</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Generate Payroll
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Payroll</span>
            <DollarSign className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{formatCurrency(totalPayroll)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Employees</span>
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{payslips.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Paid</span>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{paidCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Pending</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{unpaidCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'overview', label: 'Payroll Records', icon: FileText },
            { id: 'cycles', label: 'Payroll Cycles', icon: Calendar },
            { id: 'components', label: 'Salary Components', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedCycle ? `${getMonthName(selectedCycle.month)} ${selectedCycle.year}` : 'Select a cycle'}
                  </h3>
                  {selectedCycle && (
                    <p className="text-sm text-slate-500">
                      {new Date(selectedCycle.from_date).toLocaleDateString()} - {new Date(selectedCycle.to_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportPayrollCSV}
                    disabled={!selectedCycle || payslips.length === 0}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-slate-300 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                  {unpaidCount > 0 && (
                    <button
                      onClick={() => handleMarkPaid(payslips.filter(p => p.payment_status === 'unpaid').map(p => p.id))}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark All Paid
                    </button>
                  )}
                </div>
              </div>

              {payslips.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Employee</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Department</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Gross</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Deductions</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Net Salary</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map(payslip => (
                        <tr key={payslip.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-slate-900">
                                {payslip.employees.first_name} {payslip.employees.last_name}
                              </p>
                              <p className="text-xs text-slate-500">{payslip.employees.employee_code}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {payslip.employees.departments?.name || '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-slate-900">
                            ₹{formatCurrency(payslip.gross_salary)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-red-600">
                            -₹{formatCurrency(payslip.total_deductions)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-emerald-600">
                            ₹{formatCurrency(payslip.net_salary)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payslip.payment_status)}`}>
                              {payslip.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => downloadPayslip(payslip)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Download Payslip"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              {payslip.payment_status === 'unpaid' && (
                                <button
                                  onClick={() => handleMarkPaid([payslip.id])}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No payslips found for selected cycle</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cycles' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cycles.map(cycle => (
                  <button
                    key={cycle.id}
                    onClick={() => {
                      setSelectedCycle(cycle);
                      setActiveTab('overview');
                    }}
                    className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">
                        {getMonthName(cycle.month)} {cycle.year}
                      </h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(cycle.status)}`}>
                        {cycle.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Employees</p>
                        <p className="font-medium text-slate-900">{cycle.total_employees}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total Net</p>
                        <p className="font-medium text-emerald-600">₹{formatCurrency(cycle.total_net_salary)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {cycles.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No payroll cycles found</p>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Generate First Payroll
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'components' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Salary Components</h3>
                <button
                  onClick={() => setShowComponentModal(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Component
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-emerald-600 mb-3">Earnings</h4>
                  <div className="space-y-2">
                    {components.filter(c => c.type === 'earning').map(comp => (
                      <div key={comp.id} className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{comp.name}</p>
                            <p className="text-xs text-slate-500">{comp.code}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${comp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {comp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-red-600 mb-3">Deductions</h4>
                  <div className="space-y-2">
                    {components.filter(c => c.type === 'deduction').map(comp => (
                      <div key={comp.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{comp.name}</p>
                            <p className="text-xs text-slate-500">{comp.code}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${comp.is_active ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            {comp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Payroll Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Generate Payroll</h2>
              <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                <select
                  value={generateForm.month}
                  onChange={(e) => setGenerateForm({ ...generateForm, month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <select
                  value={generateForm.year}
                  onChange={(e) => setGenerateForm({ ...generateForm, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGeneratePayroll}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {loading ? 'Generating...' : 'Generate Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showComponentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Add Salary Component</h2>
              <button onClick={() => setShowComponentModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Component Name *</label>
                <input
                  type="text"
                  value={componentForm.name}
                  onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Performance Bonus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Component Code *</label>
                <input
                  type="text"
                  value={componentForm.code}
                  onChange={(e) => setComponentForm({ ...componentForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., PBONUS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  value={componentForm.type}
                  onChange={(e) => setComponentForm({ ...componentForm, type: e.target.value as 'earning' | 'deduction' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={componentForm.is_taxable}
                  onChange={(e) => setComponentForm({ ...componentForm, is_taxable: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm text-slate-700">Taxable</label>
              </div>
              <button
                onClick={handleAddComponent}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {loading ? 'Adding...' : 'Add Component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1] || '';
}
