interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  todayAttendance: number;
  monthlyTasks: number;
  completedTasks: number;
}

import { useEffect, useState } from 'react';
import { Users, Clock, Calendar, TrendingUp, Activity, Target, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceManageModal } from '../components/Attendance/AttendanceManageModal';

export function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const { organization, membership } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaves: 0,
    todayAttendance: 0,
    monthlyTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  // Removed unused recentActivities state
  const [weeklyAttendance, setWeeklyAttendance] = useState<{ label: string; percentage: number }[]>([]);
  // Attendance modal state for owner (single instance, top-level)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;

    loadDashboardData();

    // Set up realtime subscriptions with better event handling
    const channel = supabase.channel('dashboard-updates', {
      config: {
        broadcast: { self: true }
      }
    });

    // Subscribe to employees table changes
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'employees', 
        filter: `organization_id=eq.${organization.id}` 
      },
      (payload) => {
        console.log('Employee change detected:', payload);
        loadDashboardData();
      }
    );

    // Subscribe to departments table changes
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'departments', 
        filter: `organization_id=eq.${organization.id}` 
      },
      (payload) => {
        console.log('Department change detected:', payload);
        loadDashboardData();
      }
    );

    // Subscribe to tasks table changes
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'tasks', 
        filter: `organization_id=eq.${organization.id}` 
      },
      (payload) => {
        console.log('Task change detected:', payload);
        loadDashboardData();
      }
    );

    // Subscribe to leave_applications (no org filter, will filter in query)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leave_applications' },
      (payload) => {
        console.log('Leave application change detected:', payload);
        loadDashboardData();
      }
    );

    // Subscribe to attendance_records (no org filter, will filter in query)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_records' },
      (payload) => {
        console.log('Attendance change detected:', payload);
        loadDashboardData();
      }
    );

    channel.subscribe((status) => {
      console.log('Dashboard real-time status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Dashboard real-time subscriptions active');
      }
    });

    return () => {
      console.log('Cleaning up dashboard subscriptions');
      supabase.removeChannel(channel);
    };
  }, [organization?.id]); // Only re-subscribe when organization changes

  const loadDashboardData = async () => {
    try {
      // Only require an organization; allow owner/admin/etc.
      if (!organization?.id) {
        setLoading(false);
        return;
      }

      console.log('🔄 Loading dashboard data for organization:', organization.id);

      const todayStr = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [employeesData, leavesData, attendanceData, tasksData] = await Promise.all([
        // Employees scoped by organization_id
        supabase.from('employees').select('id, employment_status').eq('organization_id', organization.id),
        // Leave applications: scope by employee->organization
        supabase
          .from('leave_applications')
          .select('id, status, employees!inner(organization_id)')
          .eq('employees.organization_id', organization.id)
          .eq('status', 'pending'),
        // Attendance today: scope by employee->organization
        supabase
          .from('attendance_records')
          .select('id, status, attendance_date, employees!inner(organization_id)')
          .eq('employees.organization_id', organization.id)
          .eq('status', 'present')
          .eq('attendance_date', todayStr),
        // Tasks scoped by organization_id for current month
        supabase
          .from('tasks')
          .select('status')
          .eq('organization_id', organization.id)
          .gte('created_at', monthStart)
      ]);

      const totalEmployees = employeesData.data?.length || 0;
      const activeCount = employeesData.data?.filter((e: any) => e.employment_status === 'active').length || 0;
      const pendingLeaves = leavesData.data?.length || 0;
      const todayAttendance = attendanceData.data?.length || 0;
      const monthlyTasks = tasksData.data?.length || 0;
      const completedCount = tasksData.data?.filter((t: any) => t.status === 'completed').length || 0;

      console.log('📊 Dashboard stats:', {
        totalEmployees,
        activeEmployees: activeCount,
        pendingLeaves,
        todayAttendance,
        monthlyTasks,
        completedTasks: completedCount
      });

      setStats({
        totalEmployees,
        activeEmployees: activeCount,
        pendingLeaves,
        todayAttendance,
        monthlyTasks,
        completedTasks: completedCount,
      });

      // Compute weekly attendance overview (Mon-Fri of current week)
      await computeWeeklyAttendance(organization.id, activeCount);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeWeeklyAttendance = async (orgId: string, activeEmployeesCount: number) => {
    // Determine start (Monday) and end (Friday) of current week in local time
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = ((day + 6) % 7); // days since Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const days: { date: Date; label: string }[] = [];
    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ date: d, label: formatter.format(d) });
    }

    // Fetch attendance for the week (present status only) scoped by organization via employees relation
    const from = monday.toISOString().split('T')[0];
    const to = friday.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, attendance_date, status, employees!inner(organization_id)')
      .eq('employees.organization_id', orgId)
      .eq('status', 'present')
      .gte('attendance_date', from)
      .lte('attendance_date', to);

    if (error) {
      console.error('Error loading weekly attendance:', error);
      setWeeklyAttendance(days.map(d => ({ label: d.label, percentage: 0 })));
      return;
    }

    const byDateCount: Record<string, number> = {};
    for (const row of data || []) {
      const dateKey = (row as any).attendance_date;
      byDateCount[dateKey] = (byDateCount[dateKey] || 0) + 1;
    }

    const denom = Math.max(activeEmployeesCount, 1); // avoid divide by zero
    const weekly = days.map(({ date, label }) => {
      const key = date.toISOString().split('T')[0];
      const present = byDateCount[key] || 0;
      const percentage = Math.max(0, Math.min(100, Math.round((present / denom) * 100)));
      return { label, percentage };
    });

    setWeeklyAttendance(weekly);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      change: '+12%',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Active Today',
      value: stats.todayAttendance,
      change: '+8%',
      icon: Activity,
      color: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      change: '-3%',
      icon: Calendar,
      color: 'from-amber-500 to-amber-600',
      bgLight: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    {
      title: 'Tasks Completed',
      value: `${stats.completedTasks}/${stats.monthlyTasks}`,
      change: '+15%',
      icon: Target,
      color: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-50',
      textColor: 'text-violet-600'
    },
  ];

  // Attendance modal state for owner (move to top-level, only one instance)

  // Quick Action click handler
  const handleQuickAction = (action: string) => {
    if (action === 'Mark Attendance') {
      if (membership?.role === 'owner' || membership?.role === 'admin' || membership?.role === 'hr' || membership?.role === 'manager') {
        setShowAttendanceModal(true);
      } else {
        // For employees, navigate to Attendance page
        onNavigate?.('attendance');
      }
    } else if (action === 'Apply Leave') {
      onNavigate?.('leave');
    } else if (action === 'View Payslip') {
      onNavigate?.('payroll');
    } else if (action === 'Submit Expense') {
      onNavigate?.('expenses');
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's your overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.bgLight} rounded-xl p-3`}>
                  <Icon className={`h-6 w-6 ${stat.textColor}`} />
                </div>
                <span className={`text-sm font-semibold ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Attendance Overview</h3>
              <p className="text-sm text-slate-500 mt-1">Weekly attendance statistics</p>
            </div>
            <button className="text-sm text-blue-600 font-semibold hover:text-blue-700">View All</button>
          </div>

          <div className="space-y-4">
            {weeklyAttendance.map(({ label, percentage }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className="text-sm font-bold text-slate-900">{percentage}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { label: 'Mark Attendance', icon: Clock, color: 'blue' },
              { label: 'Apply Leave', icon: Calendar, color: 'emerald' },
              { label: 'View Payslip', icon: Briefcase, color: 'violet' },
              { label: 'Submit Expense', icon: TrendingUp, color: 'amber' },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.label)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-${action.color}-200 hover:bg-${action.color}-50 transition-all group`}
                >
                  <div className={`bg-${action.color}-100 rounded-lg p-2 group-hover:bg-${action.color}-200 transition-colors`}>
                    <Icon className={`h-5 w-5 text-${action.color}-600`} />
                  </div>
                  <span className="font-semibold text-slate-700 group-hover:text-slate-900">{action.label}</span>
                </button>
              );
            })}
          </div>
          {/* Attendance management modal for owner/admin */}
          {showAttendanceModal && (
            <AttendanceManageModal open={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} />
          )}
        </div>
      </div>

      {/* Performance & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Performance Metrics</h3>
              <p className="text-sm text-slate-500 mt-1">This month's overview</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tasks Completed', value: stats.completedTasks, total: stats.monthlyTasks, color: 'emerald' },
              { label: 'Avg. Rating', value: '4.8', total: '5.0', color: 'amber' },
              { label: 'Projects Done', value: '12', total: '15', color: 'blue' },
              { label: 'Team Goals', value: '8', total: '10', color: 'violet' },
            ].map((metric, idx) => (
              <div key={idx} className={`p-4 bg-${metric.color}-50 rounded-xl border border-${metric.color}-100`}>
                <p className="text-sm text-slate-600 mb-2">{metric.label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {metric.value}<span className="text-base text-slate-500">/{metric.total}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Events</h3>
          <div className="space-y-4">
            {[
              { title: 'Team Meeting', date: 'Today, 2:00 PM', type: 'meeting' },
              { title: 'Project Deadline', date: 'Tomorrow, 5:00 PM', type: 'deadline' },
              { title: 'Monthly Review', date: 'Friday, 10:00 AM', type: 'review' },
            ].map((event, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  event.type === 'meeting' ? 'bg-blue-100' :
                  event.type === 'deadline' ? 'bg-red-100' :
                  'bg-violet-100'
                }`}>
                  <Calendar className={`h-6 w-6 ${
                    event.type === 'meeting' ? 'text-blue-600' :
                    event.type === 'deadline' ? 'text-red-600' :
                    'text-violet-600'
                  }`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{event.title}</p>
                  <p className="text-sm text-slate-500">{event.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
