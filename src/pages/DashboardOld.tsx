import { useEffect, useState } from 'react';
import { Users, Clock, Calendar, DollarSign, TrendingUp, AlertCircle, ArrowUpRight, Sparkles, Activity, UserPlus, CheckCircle, X, Send, MapPin, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  todayAttendance: number;
}

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface LeaveFormData {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
}

export function Dashboard() {
  const { organization, membership, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaves: 0,
    todayAttendance: 0,
  });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState<any>(null);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [leaveFormData, setLeaveFormData] = useState<LeaveFormData>({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: ''
  });

  useEffect(() => {
    loadDashboardData();
    if (membership?.employee_id) {
      loadLeaveTypes();
      loadPayslips();
      checkTodayAttendance();
    }
  }, [organization, membership]);

  const loadDashboardData = async () => {
    try {
      if (membership?.role && ['admin', 'hr', 'finance', 'manager'].includes(membership.role)) {
        const [employeesData, leavesData, attendanceData, announcementsData] = await Promise.all([
          supabase.from('employees').select('id, employment_status', { count: 'exact' }),
          supabase.from('leave_applications').select('id', { count: 'exact' }).eq('status', 'pending'),
          supabase.from('attendance_records').select('id', { count: 'exact' }).eq('status', 'present'),
          supabase.from('announcements').select('*').eq('is_active', true).order('published_at', { ascending: false }).limit(5)
        ]);

        const activeCount = employeesData.data?.filter(e => e.employment_status === 'active').length || 0;

        setStats({
          totalEmployees: employeesData.count || 0,
          activeEmployees: activeCount,
          pendingLeaves: leavesData.count || 0,
          todayAttendance: attendanceData.count || 0,
        });

        setAnnouncements(announcementsData.data || []);
      } else {
        const announcementsData = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('published_at', { ascending: false })
          .limit(5);

        setAnnouncements(announcementsData.data || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveTypes = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('leave_types')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error loading leave types:', error);
    }
  };

  const loadPayslips = async () => {
    if (!membership?.employee_id) return;
    try {
      const { data } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .order('pay_date', { ascending: false })
        .limit(6);
      setPayslips(data || []);
    } catch (error) {
      console.error('Error loading payslips:', error);
    }
  };

  const checkTodayAttendance = async () => {
    if (!membership?.employee_id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .eq('attendance_date', today)
        .maybeSingle();
      setTodayAttendanceRecord(data);
    } catch (error) {
      console.error('Error checking attendance:', error);
    }
  };

  const handleApplyLeave = async () => {
    if (!membership?.employee_id) return;

    if (!leaveFormData.leave_type_id || !leaveFormData.from_date || !leaveFormData.to_date || !leaveFormData.reason) {
      setAlertModal({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all fields to apply for leave.'
      });
      return;
    }

    try {
      const fromDate = new Date(leaveFormData.from_date);
      const toDate = new Date(leaveFormData.to_date);
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase
        .from('leave_applications')
        .insert({
          employee_id: membership.employee_id,
          leave_type_id: leaveFormData.leave_type_id,
          from_date: leaveFormData.from_date,
          to_date: leaveFormData.to_date,
          total_days: daysDiff,
          reason: leaveFormData.reason,
          status: 'pending'
        });

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Leave Applied',
        message: `Your leave application for ${daysDiff} day(s) has been submitted successfully.`
      });

      setShowLeaveModal(false);
      setLeaveFormData({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
    } catch (error: any) {
      console.error('Error applying leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Application Failed',
        message: 'Failed to submit leave application: ' + error.message
      });
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setAlertModal({
            type: 'success',
            title: 'Location Detected',
            message: 'Your location has been captured successfully.'
          });
        },
        (error) => {
          console.error('Location error:', error);
          setAlertModal({
            type: 'error',
            title: 'Location Error',
            message: 'Failed to get your location. Please enable location services.'
          });
        }
      );
    } else {
      setAlertModal({
        type: 'error',
        title: 'Not Supported',
        message: 'Geolocation is not supported by your browser.'
      });
    }
  };

  const handleClockIn = async () => {
    if (!membership?.employee_id) return;

    if (!location) {
      setAlertModal({
        type: 'error',
        title: 'Location Required',
        message: 'Please allow location access to mark attendance.'
      });
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          employee_id: membership.employee_id,
          attendance_date: today,
          check_in_time: now,
          status: 'present',
          latitude: location.latitude,
          longitude: location.longitude,
          is_within_office_radius: true
        });

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Clocked In',
        message: 'Your attendance has been marked successfully.'
      });

      setShowAttendanceModal(false);
      await checkTodayAttendance();
    } catch (error: any) {
      console.error('Error clocking in:', error);
      setAlertModal({
        type: 'error',
        title: 'Clock In Failed',
        message: 'Failed to mark attendance: ' + error.message
      });
    }
  };

  const handleClockOut = async () => {
    if (!membership?.employee_id || !todayAttendanceRecord) return;

    if (!location) {
      setAlertModal({
        type: 'error',
        title: 'Location Required',
        message: 'Please allow location access to clock out.'
      });
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: now,
          checkout_latitude: location.latitude,
          checkout_longitude: location.longitude
        })
        .eq('id', todayAttendanceRecord.id);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Clocked Out',
        message: 'You have successfully clocked out for the day.'
      });

      setShowAttendanceModal(false);
      await checkTodayAttendance();
    } catch (error: any) {
      console.error('Error clocking out:', error);
      setAlertModal({
        type: 'error',
        title: 'Clock Out Failed',
        message: 'Failed to clock out: ' + error.message
      });
    }
  };

  const handleQuickAction = (action: string, onNavigate?: (page: string) => void) => {
    if (action === 'Mark Attendance') {
      setShowAttendanceModal(true);
      if (!location) {
        getLocation();
      }
    } else if (action === 'Apply Leave') {
      setShowLeaveModal(true);
    } else if (action === 'View Payslip') {
      setShowPayslipModal(true);
    } else if (action === 'My Profile') {
      if (onNavigate) {
        onNavigate('profile');
      }
    }
  };

  const isAdmin = membership?.role && ['admin', 'hr', 'finance', 'manager'].includes(membership.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
        </div>
      </div>
    );
  }

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
                  {alertModal.type === 'info' && <Sparkles className="h-8 w-8 text-white" />}
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

      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-scaleIn">
            <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Apply for Leave</h3>
                </div>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Leave Type</label>
                <select
                  value={leaveFormData.leave_type_id}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, leave_type_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={leaveFormData.from_date}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, from_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={leaveFormData.to_date}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, to_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason</label>
                <textarea
                  value={leaveFormData.reason}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                  rows={3}
                  placeholder="Please provide reason for leave"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyLeave}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Submit Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayslipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 animate-scaleIn max-h-[80vh] overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">View Payslips</h3>
                </div>
                <button
                  onClick={() => setShowPayslipModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {payslips.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-semibold">No payslips available</p>
                  <p className="text-sm text-slate-500 mt-1">Payslips will appear here once processed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payslips.map(payslip => (
                    <div key={payslip.id} className="p-4 border-2 border-slate-200 rounded-xl hover:border-violet-300 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {new Date(payslip.pay_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-2xl font-bold text-violet-600 mt-1">
                            ₹{parseFloat(payslip.net_pay).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Net Pay</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-600">Gross: ₹{parseFloat(payslip.gross_pay).toLocaleString()}</p>
                          <p className="text-sm text-slate-600">Deductions: ₹{parseFloat(payslip.total_deductions).toLocaleString()}</p>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                            payslip.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            payslip.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {payslip.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Mark Attendance</h3>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-6xl font-bold text-slate-900 mb-2">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <p className="text-slate-600">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {location ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Location Detected</p>
                    <p className="text-xs text-emerald-700">Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={getLocation}
                  className="w-full py-3 border-2 border-blue-200 rounded-xl font-semibold text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  Enable Location
                </button>
              )}

              {todayAttendanceRecord ? (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Clocked In</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {new Date(todayAttendanceRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {todayAttendanceRecord.check_out_time ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-sm font-semibold text-emerald-900 mb-1">Clocked Out</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {new Date(todayAttendanceRecord.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleClockOut}
                      disabled={!location}
                      className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Clock className="h-5 w-5" />
                      Clock Out
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={!location}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Clock className="h-5 w-5" />
                  Clock In
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Welcome back!
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Here's what's happening with your team today
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-full">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-blue-900">All Systems Operational</span>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Employees"
            value={stats.totalEmployees}
            icon={Users}
            gradient="from-blue-500 to-blue-600"
            bgGradient="from-blue-50 to-blue-100"
            trend="+2.5%"
            trendUp={true}
          />
          <StatCard
            title="Active Employees"
            value={stats.activeEmployees}
            icon={TrendingUp}
            gradient="from-emerald-500 to-emerald-600"
            bgGradient="from-emerald-50 to-emerald-100"
            trend="+1.2%"
            trendUp={true}
          />
          <StatCard
            title="Pending Leaves"
            value={stats.pendingLeaves}
            icon={Calendar}
            gradient="from-amber-500 to-amber-600"
            bgGradient="from-amber-50 to-amber-100"
            trend="3 awaiting"
            trendUp={false}
          />
          <StatCard
            title="Today's Attendance"
            value={`${stats.todayAttendance}/${stats.activeEmployees}`}
            icon={Clock}
            gradient="from-violet-500 to-violet-600"
            bgGradient="from-violet-50 to-violet-100"
            trend={`${Math.round((stats.todayAttendance / stats.activeEmployees) * 100)}%`}
            trendUp={true}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Announcements</h2>
            </div>
            <span className="text-xs font-medium px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
              {announcements.length} Active
            </span>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No announcements yet</p>
              <p className="text-sm text-slate-400 mt-1">Check back later for updates</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement, index) => (
                <div
                  key={announcement.id}
                  className="group relative overflow-hidden border-l-4 bg-gradient-to-r from-slate-50 to-white p-4 rounded-lg hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    borderLeftColor: announcement.priority === 'high' ? '#ef4444' :
                                    announcement.priority === 'medium' ? '#f59e0b' : '#10b981',
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {announcement.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          announcement.priority === 'high' ? 'bg-red-100 text-red-700 ring-2 ring-red-200' :
                          announcement.priority === 'medium' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' :
                          'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                        }`}>
                          {announcement.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{announcement.content}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <p className="text-xs text-slate-500 font-medium">
                          {new Date(announcement.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DashboardQuickActions onAction={handleQuickAction} />
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
          </div>

          <div className="space-y-4">
            <ActivityItem
              action="New employee added"
              user="HR Admin"
              time="2 hours ago"
              icon={UserPlus}
              gradient="from-emerald-500 to-emerald-600"
            />
            <ActivityItem
              action="Leave approved"
              user="Manager"
              time="4 hours ago"
              icon={CheckCircle}
              gradient="from-blue-500 to-blue-600"
            />
            <ActivityItem
              action="Payroll processed"
              user="Finance Team"
              time="1 day ago"
              icon={DollarSign}
              gradient="from-violet-500 to-violet-600"
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: any;
  gradient: string;
  bgGradient: string;
  trend?: string;
  trendUp: boolean;
}

function StatCard({ title, value, icon: Icon, gradient, bgGradient, trend, trendUp }: StatCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
              trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <ArrowUpRight className={`h-3 w-3 ${!trendUp && 'rotate-90'}`} />
              {trend}
            </div>
          )}
        </div>

        <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function DashboardQuickActions({ onAction }: { onAction: (action: string, onNavigate?: any) => void }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full -ml-12 -mb-12"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold">Quick Actions</h2>
        </div>

        <div className="space-y-3">
          <QuickActionButton icon={Clock} label="Mark Attendance" gradient="from-blue-500 to-blue-600" onClick={() => onAction('Mark Attendance')} />
          <QuickActionButton icon={Calendar} label="Apply Leave" gradient="from-emerald-500 to-emerald-600" onClick={() => onAction('Apply Leave')} />
          <QuickActionButton icon={DollarSign} label="View Payslip" gradient="from-violet-500 to-violet-600" onClick={() => onAction('View Payslip')} />
          <QuickActionButton icon={Users} label="My Profile" gradient="from-amber-500 to-amber-600" onClick={() => onAction('My Profile')} />
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, gradient, onClick }: { icon: any; label: string; gradient: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group w-full flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-105">
      <div className={`h-10 w-10 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <ArrowUpRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function ActivityItem({ action, user, time, icon: Icon, gradient }: { action: string; user: string; time: string; icon: any; gradient: string }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all duration-300 border border-transparent hover:border-slate-200">
      <div className={`mt-0.5 h-10 w-10 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{action}</p>
        <p className="text-xs text-slate-500 mt-1">{user} · {time}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}
