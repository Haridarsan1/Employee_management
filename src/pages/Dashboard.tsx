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
import { SetupModal } from '../components/Settings/SetupModal';
import { useSetupStatus } from '../lib/useSetupStatus';

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
  
  // Employee check-in/check-out state
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState<any>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Setup modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { setupStatus, refreshSetupStatus } = useSetupStatus(organization?.id);

  // Check if user is owner - only owners should see the setup modal
  const isOwner = membership?.role === 'owner';

  useEffect(() => {
    if (!organization?.id) return;

    loadDashboardData();
    
    // Load employee's attendance record for today if employee role
    if (membership?.employee_id) {
      loadTodayAttendance();
    }

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
        // Reload employee's attendance if they have employee_id
        if (membership?.employee_id) {
          loadTodayAttendance();
        }
      }
    );

    // Subscribe to master data changes to refresh setup status
    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'departments', 
        filter: `organization_id=eq.${organization.id}` 
      },
      () => {
        console.log('Department change detected, refreshing setup status');
        refreshSetupStatus();
      }
    );

    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'designations', 
        filter: `organization_id=eq.${organization.id}` 
      },
      () => {
        console.log('Designation change detected, refreshing setup status');
        refreshSetupStatus();
      }
    );

    channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'branches', 
        filter: `organization_id=eq.${organization.id}` 
      },
      () => {
        console.log('Branch change detected, refreshing setup status');
        refreshSetupStatus();
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

  // Effect to show setup modal for owners when setup is incomplete
  useEffect(() => {
    if (!setupStatus.loading && isOwner && !setupStatus.isComplete) {
      // Show modal after a brief delay to avoid jarring UX
      const timer = setTimeout(() => {
        setShowSetupModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [setupStatus.loading, setupStatus.isComplete, isOwner]);

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

  const loadTodayAttendance = async () => {
    if (!membership?.employee_id) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', membership.employee_id)
      .eq('attendance_date', today)
      .maybeSingle();
    
    if (!error && data) {
      setTodayAttendanceRecord(data);
    } else {
      setTodayAttendanceRecord(null);
    }
  };

  const handleCheckIn = async () => {
    if (!membership?.employee_id || !organization?.id) return;
    
    setCheckInLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      
      // Check if a record already exists for today
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .eq('attendance_date', today)
        .maybeSingle();
      
      let data;
      
      if (existingRecord) {
        // Update existing record with check-in time
        const { data: updated, error: updateError } = await supabase
          .from('attendance_records')
          .update({
            status: 'present',
            check_in_time: now,
            is_manual_entry: true,
            marked_by: membership.employee_id
          })
          .eq('id', existingRecord.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        data = updated;
      } else {
        // Create new record
        const { data: created, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            employee_id: membership.employee_id,
            attendance_date: today,
            status: 'present',
            check_in_time: now,
            is_manual_entry: true,
            marked_by: membership.employee_id
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        data = created;
      }
      
      setTodayAttendanceRecord(data);
      console.log('✅ Checked in successfully');
      
      // Reload dashboard data to update stats
      await loadDashboardData();
      await loadTodayAttendance();
    } catch (error) {
      console.error('❌ Error checking in:', error);
      alert('Failed to check in. Please try again.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendanceRecord || !membership?.employee_id) return;
    
    setCheckInLoading(true);
    try {
      const now = new Date().toISOString();
      
      // Calculate worked hours
      const checkInTime = new Date(todayAttendanceRecord.check_in_time);
      const checkOutTime = new Date(now);
      const workedHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);
      
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: now,
          worked_hours: parseFloat(workedHours)
        })
        .eq('id', todayAttendanceRecord.id)
        .select()
        .single();
      
      if (error) throw error;
      
      setTodayAttendanceRecord(data);
      console.log('✅ Checked out successfully');
      
      // Reload dashboard data to update stats
      await loadDashboardData();
    } catch (error) {
      console.error('❌ Error checking out:', error);
      alert('Failed to check out. Please try again.');
    } finally {
      setCheckInLoading(false);
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
            {/* Employee Check-In/Check-Out */}
            {membership?.employee_id && (
              <div className="pb-3 border-b border-slate-100">
                {!todayAttendanceRecord || !todayAttendanceRecord.check_in_time ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkInLoading}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <div className="bg-white/20 rounded-lg p-2">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-semibold block">Check In</span>
                      <span className="text-xs text-emerald-100">Start your day</span>
                    </div>
                  </button>
                ) : !todayAttendanceRecord.check_out_time ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-emerald-700">Active Today</span>
                      <span className="text-xs text-emerald-600 ml-auto">
                        Since {new Date(todayAttendanceRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={handleCheckOut}
                      disabled={checkInLoading}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      <div className="bg-white/20 rounded-lg p-2">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-semibold block">Check Out</span>
                        <span className="text-xs text-blue-100">End your day</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 bg-slate-400 rounded-full"></div>
                      <span className="text-sm font-semibold text-slate-700">Completed for Today</span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div>Check-in: {new Date(todayAttendanceRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>Check-out: {new Date(todayAttendanceRecord.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="font-semibold text-slate-700">Hours: {todayAttendanceRecord.worked_hours || 0}h</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Regular Quick Actions */}
            {[
              { label: 'Mark Attendance', icon: Clock, color: 'blue', roles: ['owner', 'admin', 'hr', 'manager'] },
              { label: 'Apply Leave', icon: Calendar, color: 'emerald', roles: ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'] },
              { label: 'View Payslip', icon: Briefcase, color: 'violet', roles: ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'] },
              { label: 'Submit Expense', icon: TrendingUp, color: 'amber', roles: ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'] },
            ].filter(action => !action.roles || action.roles.includes(membership?.role || '')).map((action, idx) => {
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

      {/* Setup Modal for Owners */}
      {isOwner && (
        <SetupModal
          open={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          onNavigateToSettings={() => {
            setShowSetupModal(false);
            if (onNavigate) {
              onNavigate('settings');
            }
          }}
          setupStatus={{
            hasDepartments: setupStatus.hasDepartments,
            hasDesignations: setupStatus.hasDesignations,
            hasBranches: setupStatus.hasBranches,
          }}
        />
      )}

      {/* Attendance Modal for Owner/Admin */}
      {(membership?.role === 'owner' || membership?.role === 'admin') && (
        <AttendanceManageModal open={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} />
      )}
    </div>
  );
}
