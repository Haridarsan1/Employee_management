import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Filter, Users, Clock, DollarSign, TrendingUp, BarChart3, PieChart, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Area, AreaChart, Pie } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ReportFilters {
  startDate: string;
  endDate: string;
  employeeId?: string;
  department?: string;
  reportType: 'attendance' | 'leave' | 'payroll' | 'employee' | null;
}

interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalHalfDay: number;
  totalLate: number;
  averageWorkHours: number;
}

interface LeaveStats {
  totalLeavesTaken: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  availableBalance: number;
}

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function ReportsPage() {
  const { organization, membership } = useAuth();
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reportType: null
  });
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);

  useEffect(() => {
    if (organization?.id) {
      loadEmployees();
    }
  }, [organization]);

  const loadEmployees = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, department_id')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .order('employee_code');
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const generateAttendanceReport = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          employees (
            employee_code,
            first_name,
            last_name,
            department_id,
            departments (name)
          )
        `)
        .gte('attendance_date', filters.startDate)
        .lte('attendance_date', filters.endDate)
        .order('attendance_date', { ascending: false });

      if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats: AttendanceStats = {
        totalPresent: data?.filter(r => r.status === 'present').length || 0,
        totalAbsent: data?.filter(r => r.status === 'absent').length || 0,
        totalHalfDay: data?.filter(r => r.status === 'half_day').length || 0,
        totalLate: data?.filter(r => {
          if (!r.check_in_time) return false;
          const checkInTime = new Date(r.check_in_time);
          const hours = checkInTime.getHours();
          const minutes = checkInTime.getMinutes();
          return hours > 9 || (hours === 9 && minutes > 30);
        }).length || 0,
        averageWorkHours: calculateAverageWorkHours(data || [])
      };

      setReportData({ records: data, stats, type: 'attendance' });
      setActiveReport('attendance');
    } catch (error) {
      console.error('Error generating attendance report:', error);
      setAlertModal({
        type: 'error',
        title: 'Report Generation Failed',
        message: 'Failed to generate attendance report. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLeaveReport = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('leave_applications')
        .select(`
          *,
          employees (
            employee_code,
            first_name,
            last_name,
            department_id,
            departments (name)
          ),
          leave_types (
            name,
            code
          )
        `)
        .gte('from_date', filters.startDate)
        .lte('to_date', filters.endDate)
        .order('from_date', { ascending: false });

      if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }

      const { data: leaveData, error: leaveError } = await query;
      if (leaveError) throw leaveError;

      let balanceQuery = supabase
        .from('leave_balances')
        .select(`
          *,
          employees (
            employee_code,
            first_name,
            last_name
          ),
          leave_types (
            name,
            code
          )
        `)
        .eq('year', new Date().getFullYear());

      if (filters.employeeId) {
        balanceQuery = balanceQuery.eq('employee_id', filters.employeeId);
      }

      const { data: balanceData, error: balanceError } = await balanceQuery;
      if (balanceError) throw balanceError;

      const stats: LeaveStats = {
        totalLeavesTaken: leaveData?.filter(l => l.status === 'approved').reduce((sum, l) => sum + Number(l.total_days), 0) || 0,
        pendingRequests: leaveData?.filter(l => l.status === 'pending').length || 0,
        approvedRequests: leaveData?.filter(l => l.status === 'approved').length || 0,
        rejectedRequests: leaveData?.filter(l => l.status === 'rejected').length || 0,
        availableBalance: balanceData?.reduce((sum, b) => sum + Number(b.available_leaves), 0) || 0
      };

      setReportData({
        applications: leaveData,
        balances: balanceData,
        stats,
        type: 'leave'
      });
      setActiveReport('leave');
    } catch (error) {
      console.error('Error generating leave report:', error);
      setAlertModal({
        type: 'error',
        title: 'Report Generation Failed',
        message: 'Failed to generate leave report. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePayrollReport = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('salary_structures')
        .select(`
          *,
          employees (
            employee_code,
            first_name,
            last_name,
            department_id,
            departments (name)
          ),
          component:salary_components (
            name,
            code,
            type
          )
        `)
        .eq('is_active', true);

      if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const employeeSalaries = new Map();
      data?.forEach(record => {
        const empId = record.employee_id;
        if (!employeeSalaries.has(empId)) {
          employeeSalaries.set(empId, {
            employee: record.employees,
            earnings: 0,
            deductions: 0,
            components: []
          });
        }
        const empData = employeeSalaries.get(empId);
        empData.components.push({
          name: record.component.name,
          code: record.component.code,
          type: record.component.type,
          amount: record.amount
        });
        if (record.component.type === 'earning') {
          empData.earnings += Number(record.amount);
        } else {
          empData.deductions += Number(record.amount);
        }
      });

      const payrollData = Array.from(employeeSalaries.values()).map(emp => ({
        ...emp,
        netSalary: emp.earnings - emp.deductions
      }));

      const stats = {
        totalEmployees: payrollData.length,
        totalEarnings: payrollData.reduce((sum, e) => sum + e.earnings, 0),
        totalDeductions: payrollData.reduce((sum, e) => sum + e.deductions, 0),
        totalNetSalary: payrollData.reduce((sum, e) => sum + e.netSalary, 0)
      };

      setReportData({ payroll: payrollData, stats, type: 'payroll' });
      setActiveReport('payroll');
    } catch (error) {
      console.error('Error generating payroll report:', error);
      setAlertModal({
        type: 'error',
        title: 'Report Generation Failed',
        message: 'Failed to generate payroll report. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateEmployeeReport = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          departments (name),
          designations (title),
          branches (name)
        `)
        .eq('organization_id', organization.id);

      if (filters.employeeId) {
        query = query.eq('id', filters.employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        totalEmployees: data?.length || 0,
        activeEmployees: data?.filter(e => e.status === 'active').length || 0,
        inactiveEmployees: data?.filter(e => e.status === 'inactive').length || 0,
        onProbation: data?.filter(e => e.employment_type === 'probation').length || 0
      };

      setReportData({ employees: data, stats, type: 'employee' });
      setActiveReport('employee');
    } catch (error) {
      console.error('Error generating employee report:', error);
      setAlertModal({
        type: 'error',
        title: 'Report Generation Failed',
        message: 'Failed to generate employee report. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageWorkHours = (records: any[]) => {
    const validRecords = records.filter(r => r.check_in_time && r.check_out_time);
    if (validRecords.length === 0) return 0;

    const totalMinutes = validRecords.reduce((sum, r) => {
      const checkIn = new Date(r.check_in_time);
      const checkOut = new Date(r.check_out_time);
      const diff = checkOut.getTime() - checkIn.getTime();
      return sum + (diff / 1000 / 60);
    }, 0);

    return Math.round((totalMinutes / validRecords.length) / 60 * 10) / 10;
  };

  const prepareAttendanceChartData = (records: any[]) => {
    const dailyData = records.reduce((acc, record) => {
      const date = record.attendance_date;
      if (!acc[date]) {
        acc[date] = { date, present: 0, absent: 0, half_day: 0, late: 0 };
      }
      if (record.status === 'present') acc[date].present++;
      else if (record.status === 'absent') acc[date].absent++;
      else if (record.status === 'half_day') acc[date].half_day++;

      // Check if late
      if (record.check_in_time) {
        const checkInTime = new Date(record.check_in_time);
        const hours = checkInTime.getHours();
        const minutes = checkInTime.getMinutes();
        if (hours > 9 || (hours === 9 && minutes > 30)) {
          acc[date].late++;
        }
      }
      return acc;
    }, {});

    return Object.values(dailyData).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const prepareLeaveChartData = (applications: any[]) => {
    const leaveTypeData = applications.reduce((acc, app) => {
      const type = app.leave_types?.name || 'Other';
      if (!acc[type]) {
        acc[type] = { name: type, value: 0, approved: 0, pending: 0, rejected: 0 };
      }
      acc[type].value += Number(app.total_days);
      if (app.status === 'approved') acc[type].approved += Number(app.total_days);
      else if (app.status === 'pending') acc[type].pending += Number(app.total_days);
      else if (app.status === 'rejected') acc[type].rejected += Number(app.total_days);
      return acc;
    }, {});

    return Object.values(leaveTypeData);
  };

  const prepareDepartmentChartData = (employees: any[]) => {
    const deptData = employees.reduce((acc, emp) => {
      const dept = emp.departments?.name || 'Unassigned';
      if (!acc[dept]) {
        acc[dept] = { name: dept, count: 0 };
      }
      acc[dept].count++;
      return acc;
    }, {});

    return Object.values(deptData);
  };

  const exportToCSV = (reportType: string) => {
    if (!reportData) return;

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'attendance':
        filename = `Attendance_Report_${filters.startDate}_to_${filters.endDate}.csv`;
        csvContent = 'Employee Code,Name,Date,Check In,Check Out,Status,Location\n';
        reportData.records.forEach((r: any) => {
          const name = `${r.employees.first_name} ${r.employees.last_name}`;
          const checkIn = r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '-';
          const checkOut = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '-';
          const location = r.is_within_office_radius ? 'In Office' : 'Remote';
          csvContent += `${r.employees.employee_code},"${name}",${r.attendance_date},${checkIn},${checkOut},${r.status},${location}\n`;
        });
        break;

      case 'leave':
        filename = `Leave_Report_${filters.startDate}_to_${filters.endDate}.csv`;
        csvContent = 'Employee Code,Name,Leave Type,From Date,To Date,Days,Status,Reason\n';
        reportData.applications.forEach((l: any) => {
          const name = `${l.employees.first_name} ${l.employees.last_name}`;
          csvContent += `${l.employees.employee_code},"${name}",${l.leave_types.name},${l.from_date},${l.to_date},${l.total_days},${l.status},"${l.reason}"\n`;
        });
        break;

      case 'payroll':
        filename = `Payroll_Report_${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = 'Employee Code,Name,Department,Gross Salary,Deductions,Net Salary\n';
        reportData.payroll.forEach((p: any) => {
          const name = `${p.employee.first_name} ${p.employee.last_name}`;
          const dept = p.employee.departments?.name || 'N/A';
          csvContent += `${p.employee.employee_code},"${name}","${dept}",${p.earnings},${p.deductions},${p.netSalary}\n`;
        });
        break;

      case 'employee':
        filename = `Employee_Master_${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = 'Employee Code,Name,Email,Phone,Department,Designation,Status,Joining Date\n';
        reportData.employees.forEach((e: any) => {
          const name = `${e.first_name} ${e.last_name}`;
          const dept = e.departments?.name || 'N/A';
          const desig = e.designations?.title || 'N/A';
          csvContent += `${e.employee_code},"${name}",${e.company_email},${e.phone_number},"${dept}","${desig}",${e.status},${e.joining_date}\n`;
        });
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    setAlertModal({
      type: 'success',
      title: 'Export Successful',
      message: `Report has been exported as ${filename}`
    });
  };

  return (
    <>
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className={`p-6 rounded-t-2xl ${
              alertModal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
              alertModal.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
              'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {alertModal.type === 'success' && <CheckCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'error' && <AlertCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'info' && <FileText className="h-8 w-8 text-white" />}
                  <h3 className="text-xl font-bold text-white">{alertModal.title}</h3>
                </div>
                <button
                  onClick={() => setAlertModal(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-lg">{alertModal.message}</p>
              <button
                onClick={() => setAlertModal(null)}
                className={`mt-6 w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  alertModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Reports & Analytics
            </h1>
            <p className="text-slate-600 mt-2">Generate comprehensive reports and insights</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Filter className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Report Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Employee</label>
              <select
                value={filters.employeeId || ''}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value || undefined })}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} - {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ReportCard
            title="Attendance Report"
            description="Daily attendance records with check-in/out times"
            icon={Clock}
            iconColor="from-blue-500 to-blue-600"
            onGenerate={generateAttendanceReport}
            onExport={() => exportToCSV('attendance')}
            loading={loading}
            hasData={activeReport === 'attendance'}
          />
          <ReportCard
            title="Leave Report"
            description="Leave applications and balance summary"
            icon={Calendar}
            iconColor="from-emerald-500 to-emerald-600"
            onGenerate={generateLeaveReport}
            onExport={() => exportToCSV('leave')}
            loading={loading}
            hasData={activeReport === 'leave'}
          />
          <ReportCard
            title="Payroll Report"
            description="Salary structure and component details"
            icon={DollarSign}
            iconColor="from-violet-500 to-violet-600"
            onGenerate={generatePayrollReport}
            onExport={() => exportToCSV('payroll')}
            loading={loading}
            hasData={activeReport === 'payroll'}
          />
          <ReportCard
            title="Employee Master"
            description="Complete employee database with details"
            icon={Users}
            iconColor="from-amber-500 to-amber-600"
            onGenerate={generateEmployeeReport}
            onExport={() => exportToCSV('employee')}
            loading={loading}
            hasData={activeReport === 'employee'}
          />
        </div>

        {reportData && activeReport === 'attendance' && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Attendance Summary</h2>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard label="Present" value={reportData.stats.totalPresent} color="text-emerald-600" />
              <StatCard label="Absent" value={reportData.stats.totalAbsent} color="text-red-600" />
              <StatCard label="Half Day" value={reportData.stats.totalHalfDay} color="text-amber-600" />
              <StatCard label="Late" value={reportData.stats.totalLate} color="text-orange-600" />
              <StatCard label="Avg Hours" value={`${reportData.stats.averageWorkHours}h`} color="text-blue-600" />
            </div>

            {/* Attendance Trend Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Attendance Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={prepareAttendanceChartData(reportData.records)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="present" stackId="1" stroke="#10b981" fill="#10b981" name="Present" />
                  <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="#ef4444" name="Absent" />
                  <Area type="monotone" dataKey="half_day" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Half Day" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check In</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check Out</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.records.map((record: any) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {record.employees.first_name} {record.employees.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{record.employees.employee_code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{new Date(record.attendance_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                          record.status === 'absent' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          record.is_within_office_radius ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {record.is_within_office_radius ? 'In Office' : 'Remote'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportData && activeReport === 'leave' && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Leave Summary</h2>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard label="Leaves Taken" value={reportData.stats.totalLeavesTaken} color="text-blue-600" />
              <StatCard label="Pending" value={reportData.stats.pendingRequests} color="text-amber-600" />
              <StatCard label="Approved" value={reportData.stats.approvedRequests} color="text-emerald-600" />
              <StatCard label="Rejected" value={reportData.stats.rejectedRequests} color="text-red-600" />
              <StatCard label="Available" value={reportData.stats.availableBalance} color="text-violet-600" />
            </div>

            {/* Leave Types Distribution Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Leave Types Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={prepareLeaveChartData(reportData.applications) as any}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareLeaveChartData(reportData.applications).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Leave Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">From</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">To</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Days</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.applications.map((leave: any) => (
                    <tr key={leave.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {leave.employees.first_name} {leave.employees.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{leave.employees.employee_code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {leave.leave_types.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{new Date(leave.from_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-700">{new Date(leave.to_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-700">{leave.total_days}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          leave.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate">{leave.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportData && activeReport === 'payroll' && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Payroll Summary</h2>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Employees" value={reportData.stats.totalEmployees} color="text-blue-600" />
              <StatCard label="Gross Earnings" value={`₹${reportData.stats.totalEarnings.toLocaleString()}`} color="text-emerald-600" />
              <StatCard label="Total Deductions" value={`₹${reportData.stats.totalDeductions.toLocaleString()}`} color="text-red-600" />
              <StatCard label="Net Payable" value={`₹${reportData.stats.totalNetSalary.toLocaleString()}`} color="text-violet-600" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Department</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Gross Salary</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Deductions</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.payroll.map((payroll: any, index: number) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {payroll.employee.first_name} {payroll.employee.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{payroll.employee.employee_code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{payroll.employee.departments?.name || 'N/A'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">₹{payroll.earnings.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold text-red-600">₹{payroll.deductions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">₹{payroll.netSalary.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportData && activeReport === 'employee' && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Employee Master Report</h2>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Employees" value={reportData.stats.totalEmployees} color="text-blue-600" />
              <StatCard label="Active" value={reportData.stats.activeEmployees} color="text-emerald-600" />
              <StatCard label="Inactive" value={reportData.stats.inactiveEmployees} color="text-slate-600" />
              <StatCard label="On Probation" value={reportData.stats.onProbation} color="text-amber-600" />
            </div>

            {/* Department Distribution Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Department Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareDepartmentChartData(reportData.employees)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Designation</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Joining Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employees.map((emp: any) => (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{emp.employee_code}</td>
                      <td className="py-3 px-4 text-slate-700">{emp.first_name} {emp.last_name}</td>
                      <td className="py-3 px-4 text-slate-700">{emp.company_email}</td>
                      <td className="py-3 px-4 text-slate-700">{emp.departments?.name || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-700">{emp.designations?.title || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{new Date(emp.joining_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ReportCard({
  title,
  description,
  icon: Icon,
  iconColor,
  onGenerate,
  onExport,
  loading,
  hasData
}: {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  onGenerate: () => void;
  onExport: () => void;
  loading: boolean;
  hasData: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 bg-gradient-to-br ${iconColor} rounded-xl`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {hasData && (
          <button
            onClick={onExport}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            title="Export to CSV"
          >
            <Download className="h-5 w-5" />
          </button>
        )}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Generating...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Generate Report
          </>
        )}
      </button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
      <p className="text-sm text-slate-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
