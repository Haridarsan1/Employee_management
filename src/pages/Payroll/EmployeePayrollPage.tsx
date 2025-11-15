import { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, Download, FileText, 
  Clock, TrendingUp, AlertCircle 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Payslip {
  id: string;
  payroll_cycle_id: string;
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
  created_at: string;
  payroll_cycles: {
    month: number;
    year: number;
    from_date: string;
    to_date: string;
  };
}

export function EmployeePayrollPage() {
  const { organization, membership } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    if (organization?.id && membership?.employee_id) {
      loadPayslips();
    }
  }, [organization, membership]);

  useEffect(() => {
    if (payslips.length > 0) {
      const current = payslips.find(
        p => p.payroll_cycles.month === selectedMonth.month && p.payroll_cycles.year === selectedMonth.year
      );
      setSelectedPayslip(current || null);
    }
  }, [selectedMonth, payslips]);

  const loadPayslips = async () => {
    if (!organization?.id || !membership?.employee_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select(`
          *,
          payroll_cycles (
            month,
            year,
            from_date,
            to_date
          )
        `)
        .eq('employee_id', membership.employee_id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw error;
      setPayslips(data || []);
      
      // Auto-select current month's payslip if available
      if (data && data.length > 0) {
        const current = data.find(
          p => p.payroll_cycles.month === selectedMonth.month && p.payroll_cycles.year === selectedMonth.year
        );
        setSelectedPayslip(current || data[0]);
      }
    } catch (error) {
      console.error('Error loading payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPayslip = () => {
    if (!selectedPayslip) return;
    
    const cycle = selectedPayslip.payroll_cycles;
    const text = `
PAYSLIP - ${getMonthName(cycle.month)} ${cycle.year}
===============================================
Period: ${new Date(cycle.from_date).toLocaleDateString()} - ${new Date(cycle.to_date).toLocaleDateString()}
Working Days: ${selectedPayslip.working_days}
Present Days: ${selectedPayslip.present_days}

EARNINGS:
${Object.entries(selectedPayslip.earnings || {}).map(([k, v]) => `${k.toUpperCase()}: ₹${formatCurrency(v as number)}`).join('\n')}
───────────────────────────────────────────────
TOTAL EARNINGS: ₹${formatCurrency(selectedPayslip.total_earnings)}

DEDUCTIONS:
${Object.entries(selectedPayslip.deductions || {}).map(([k, v]) => `${k.toUpperCase()}: ₹${formatCurrency(v as number)}`).join('\n')}
───────────────────────────────────────────────
TOTAL DEDUCTIONS: ₹${formatCurrency(selectedPayslip.total_deductions)}

═══════════════════════════════════════════════
NET SALARY: ₹${formatCurrency(selectedPayslip.net_salary)}
═══════════════════════════════════════════════

Payment Status: ${selectedPayslip.payment_status.toUpperCase()}
${selectedPayslip.payment_date ? `Payment Date: ${new Date(selectedPayslip.payment_date).toLocaleDateString()}` : ''}

Generated on: ${new Date(selectedPayslip.created_at).toLocaleDateString()}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${cycle.month}_${cycle.year}.txt`;
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
      paid: 'bg-emerald-100 text-emerald-700',
      unpaid: 'bg-amber-100 text-amber-700',
      processing: 'bg-blue-100 text-blue-700'
    };
    return colors[status] || colors.unpaid;
  };

  const availableMonths = payslips.map(p => ({
    month: p.payroll_cycles.month,
    year: p.payroll_cycles.year,
    id: p.id
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Payroll</h1>
          <p className="text-slate-500 mt-1">View your salary details and download payslips</p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-3">Select Pay Period</label>
        <div className="grid grid-cols-2 gap-4">
          <select
            value={selectedMonth.month}
            onChange={(e) => setSelectedMonth({ ...selectedMonth, month: parseInt(e.target.value) })}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
          <select
            value={selectedMonth.year}
            onChange={(e) => setSelectedMonth({ ...selectedMonth, year: parseInt(e.target.value) })}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payslip Content */}
      {selectedPayslip ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-100">Total Earnings</span>
                <TrendingUp className="h-5 w-5 text-emerald-200" />
              </div>
              <p className="text-3xl font-bold">₹{formatCurrency(selectedPayslip.total_earnings)}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-100">Total Deductions</span>
                <TrendingUp className="h-5 w-5 text-red-200 rotate-180" />
              </div>
              <p className="text-3xl font-bold">₹{formatCurrency(selectedPayslip.total_deductions)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100">Net Salary</span>
                <DollarSign className="h-5 w-5 text-blue-200" />
              </div>
              <p className="text-3xl font-bold">₹{formatCurrency(selectedPayslip.net_salary)}</p>
            </div>
          </div>

          {/* Payslip Details */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {getMonthName(selectedPayslip.payroll_cycles.month)} {selectedPayslip.payroll_cycles.year}
                  </h2>
                  <p className="text-blue-100">
                    {new Date(selectedPayslip.payroll_cycles.from_date).toLocaleDateString()} - {new Date(selectedPayslip.payroll_cycles.to_date).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={downloadPayslip}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Attendance Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Working Days</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedPayslip.working_days}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-600 mb-1">Present Days</p>
                  <p className="text-2xl font-bold text-emerald-700">{selectedPayslip.present_days}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Payment Status</p>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedPayslip.payment_status)}`}>
                    {selectedPayslip.payment_status}
                  </span>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                  Earnings
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedPayslip.earnings || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-700 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-slate-900">₹{formatCurrency(value as number)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 border-t-2 border-emerald-200 bg-emerald-50 px-4 rounded-lg">
                    <span className="font-semibold text-emerald-700">Total Earnings</span>
                    <span className="text-xl font-bold text-emerald-700">₹{formatCurrency(selectedPayslip.total_earnings)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                  Deductions
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedPayslip.deductions || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-700 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-red-600">-₹{formatCurrency(value as number)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 border-t-2 border-red-200 bg-red-50 px-4 rounded-lg">
                    <span className="font-semibold text-red-700">Total Deductions</span>
                    <span className="text-xl font-bold text-red-700">-₹{formatCurrency(selectedPayslip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 mb-1">Net Pay for {getMonthName(selectedPayslip.payroll_cycles.month)}</p>
                    <p className="text-3xl font-bold text-blue-700">₹{formatCurrency(selectedPayslip.net_salary)}</p>
                  </div>
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                    <DollarSign className="h-8 w-8 text-white" />
                  </div>
                </div>
                {selectedPayslip.payment_date && (
                  <p className="text-sm text-blue-600 mt-3">
                    Paid on: {new Date(selectedPayslip.payment_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payslip History */}
          {availableMonths.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Previous Payslips</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableMonths.slice(0, 8).map((month, idx) => (
                  <button
                    key={month.id}
                    onClick={() => setSelectedMonth({ month: month.month, year: month.year })}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      selectedPayslip.id === month.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="font-medium">{getMonthName(month.month)}</p>
                    <p className="text-sm">{month.year}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Payroll Not Available
          </h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Payroll for {getMonthName(selectedMonth.month)} {selectedMonth.year} has not been generated yet. 
            Please check back later or contact HR for more information.
          </p>
          {availableMonths.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-slate-600 mb-3">Available pay periods:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableMonths.slice(0, 6).map(month => (
                  <button
                    key={month.id}
                    onClick={() => setSelectedMonth({ month: month.month, year: month.year })}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    {getMonthName(month.month)} {month.year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}
