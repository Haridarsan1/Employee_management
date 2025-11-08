import { useEffect, useState } from 'react';
import { Calendar, Plus, X, Send, CheckCircle, AlertCircle, Clock, TrendingUp, FileText, Download, Eye, Check, XCircle, Sparkles, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  total_leaves: number;
  used_leaves: number;
  available_leaves: number;
  leave_types: LeaveType;
}

interface LeaveApplication {
  id: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  status: string;
  applied_date: string;
  approved_by: string | null;
  approved_date: string | null;
  rejected_reason: string | null;
  leave_types: LeaveType;
}

interface AlertModal {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ApplyLeaveForm {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  half_day: boolean;
  contact_number: string;
}

export function LeavePage() {
  const { membership, organization } = useAuth();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [pendingApplications, setPendingApplications] = useState<LeaveApplication[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<ApplyLeaveForm>({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: '',
    half_day: false,
    contact_number: ''
  });

  const isManager = membership?.role && ['admin', 'hr', 'manager'].includes(membership.role);

  useEffect(() => {
    loadLeaveData();
  }, [membership, organization]);

  const loadLeaveData = async () => {
    try {
      await Promise.all([
        loadLeaveTypes(),
        loadLeaveBalances(),
        loadLeaveApplications(),
        isManager && loadPendingApplications()
      ]);
    } catch (error) {
      console.error('Error loading leave data:', error);
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

  const loadLeaveBalances = async () => {
    if (!membership?.employee_id) return;
    try {
      const currentYear = new Date().getFullYear();
      const { data } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_types (*)
        `)
        .eq('employee_id', membership.employee_id)
        .eq('year', currentYear);
      setLeaveBalances(data || []);
    } catch (error) {
      console.error('Error loading leave balances:', error);
    }
  };

  const loadLeaveApplications = async () => {
    if (!membership?.employee_id) return;
    try {
      const { data } = await supabase
        .from('leave_applications')
        .select(`
          *,
          leave_types (*)
        `)
        .eq('employee_id', membership.employee_id)
        .order('applied_date', { ascending: false })
        .limit(20);
      setLeaveApplications(data || []);
    } catch (error) {
      console.error('Error loading leave applications:', error);
    }
  };

  const loadPendingApplications = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('leave_applications')
        .select(`
          *,
          leave_types (*),
          employees (first_name, last_name, employee_code)
        `)
        .eq('status', 'pending')
        .order('applied_date', { ascending: false });
      setPendingApplications(data || []);
    } catch (error) {
      console.error('Error loading pending applications:', error);
    }
  };

  const calculateDays = () => {
    if (!formData.from_date || !formData.to_date) return 0;
    const from = new Date(formData.from_date);
    const to = new Date(formData.to_date);
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return formData.half_day ? 0.5 : days;
  };

  const validateLeaveApplication = (): string | null => {
    if (!formData.leave_type_id) return 'Please select a leave type';
    if (!formData.from_date) return 'Please select from date';
    if (!formData.to_date) return 'Please select to date';
    if (!formData.reason.trim()) return 'Please provide a reason';
    if (formData.reason.trim().length < 10) return 'Reason must be at least 10 characters';

    const from = new Date(formData.from_date);
    const to = new Date(formData.to_date);
    if (to < from) return 'To date must be after from date';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (from < today) return 'Cannot apply for past dates';

    const days = calculateDays();
    const balance = leaveBalances.find(b => b.leave_type_id === formData.leave_type_id);
    if (balance && days > balance.available_leaves) {
      return `Insufficient leave balance. Available: ${balance.available_leaves} days`;
    }

    return null;
  };

  const handleApplyLeave = async () => {
    const error = validateLeaveApplication();
    if (error) {
      setAlertModal({
        type: 'error',
        title: 'Validation Error',
        message: error
      });
      return;
    }

    if (!membership?.employee_id) return;

    try {
      const days = calculateDays();

      const { error: insertError } = await supabase
        .from('leave_applications')
        .insert({
          employee_id: membership.employee_id,
          leave_type_id: formData.leave_type_id,
          from_date: formData.from_date,
          to_date: formData.to_date,
          total_days: days,
          reason: formData.reason,
          contact_number: formData.contact_number || null,
          is_half_day: formData.half_day,
          status: 'pending',
          applied_date: new Date().toISOString()
        });

      if (insertError) throw insertError;

      setAlertModal({
        type: 'success',
        title: 'Leave Applied Successfully',
        message: `Your leave application for ${days} day(s) has been submitted and is pending approval.`
      });

      setShowApplyModal(false);
      setFormData({
        leave_type_id: '',
        from_date: '',
        to_date: '',
        reason: '',
        half_day: false,
        contact_number: ''
      });
      setSelectedLeaveType(null);

      await loadLeaveApplications();
    } catch (error: any) {
      console.error('Error applying leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Application Failed',
        message: error.message || 'Failed to submit leave application'
      });
    }
  };

  const handleApprove = async (applicationId: string) => {
    if (!membership?.user_id) return;

    try {
      const { error } = await supabase
        .from('leave_applications')
        .update({
          status: 'approved',
          approved_by: membership.user_id,
          approved_date: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Leave Approved',
        message: 'Leave application has been approved successfully.'
      });

      await loadPendingApplications();
      await loadLeaveApplications();
    } catch (error: any) {
      console.error('Error approving leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Approval Failed',
        message: error.message || 'Failed to approve leave'
      });
    }
  };

  const handleReject = async (applicationId: string, reason: string) => {
    if (!membership?.user_id) return;

    try {
      const { error } = await supabase
        .from('leave_applications')
        .update({
          status: 'rejected',
          approved_by: membership.user_id,
          approved_date: new Date().toISOString(),
          rejected_reason: reason
        })
        .eq('id', applicationId);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Leave Rejected',
        message: 'Leave application has been rejected.'
      });

      await loadPendingApplications();
      await loadLeaveApplications();
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Rejection Failed',
        message: error.message || 'Failed to reject leave'
      });
    }
  };

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    setFormData({ ...formData, leave_type_id: leaveTypeId });
    const type = leaveTypes.find(t => t.id === leaveTypeId);
    setSelectedLeaveType(type || null);
  };

  const getColorClasses = (color: string) => {
    const colors: { [key: string]: string } = {
      blue: 'from-blue-500 to-blue-600',
      red: 'from-red-500 to-red-600',
      green: 'from-emerald-500 to-emerald-600',
      purple: 'from-violet-500 to-violet-600',
      yellow: 'from-amber-500 to-amber-600',
      orange: 'from-orange-500 to-orange-600',
    };
    return colors[color] || colors.blue;
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      approved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border-2 ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <Calendar className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
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
              alertModal.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
              'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {alertModal.type === 'success' && <CheckCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'error' && <AlertCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'warning' && <AlertTriangle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'info' && <Info className="h-8 w-8 text-white" />}
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
                  alertModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 animate-scaleIn">
            <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Apply for Leave</h3>
                </div>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.leave_type_id}
                  onChange={(e) => handleLeaveTypeChange(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(type => {
                    const balance = leaveBalances.find(b => b.leave_type_id === type.id);
                    return (
                      <option key={type.id} value={type.id}>
                        {type.name} {balance ? `(${balance.available_leaves} available)` : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedLeaveType && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Available Balance:</strong>{' '}
                      {leaveBalances.find(b => b.leave_type_id === selectedLeaveType.id)?.available_leaves || 0} days
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    min={formData.from_date || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {formData.from_date && formData.to_date && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-900">Total Days:</span>
                    <span className="text-2xl font-bold text-emerald-600">{calculateDays()}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.half_day}
                    onChange={(e) => setFormData({ ...formData, half_day: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">Half Day Leave</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Contact Number (During Leave)
                </label>
                <input
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reason for Leave <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={4}
                  placeholder="Please provide a detailed reason (minimum 10 characters)"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.reason.length}/10 characters minimum
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowApplyModal(false)}
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

      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
              <Calendar className="h-8 w-8 text-emerald-600" />
              Leave Management
            </h1>
            <p className="text-slate-600 mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Manage your leave applications and balances
            </p>
          </div>
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5" />
            Apply Leave
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {leaveBalances.length === 0 ? (
            <div className="col-span-4 bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold">No leave balances configured</p>
              <p className="text-sm text-slate-500 mt-1">Contact HR to set up your leave balances</p>
            </div>
          ) : (
            leaveBalances.map(balance => (
              <LeaveBalanceCard key={balance.id} balance={balance} />
            ))
          )}
        </div>

        {isManager && pendingApplications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pending Approvals</h2>
                <p className="text-sm text-slate-600">{pendingApplications.length} application(s) awaiting action</p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingApplications.map(app => (
                <PendingApplicationCard
                  key={app.id}
                  application={app}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Leave Applications</h2>
              <p className="text-sm text-slate-600">Your leave application history</p>
            </div>
          </div>

          {leaveApplications.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold">No leave applications yet</p>
              <p className="text-sm text-slate-500 mt-1">Click "Apply Leave" to submit your first application</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveApplications.map(app => (
                <LeaveApplicationCard key={app.id} application={app} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  const percentage = (balance.available_leaves / balance.total_leaves) * 100;
  const colorGradient = balance.leave_types.color || 'blue';

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all hover:scale-105">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorGradient === 'blue' ? 'from-blue-500 to-blue-600' :
          colorGradient === 'red' ? 'from-red-500 to-red-600' :
          colorGradient === 'green' ? 'from-emerald-500 to-emerald-600' :
          colorGradient === 'purple' ? 'from-violet-500 to-violet-600' :
          'from-blue-500 to-blue-600'}`}>
          <Calendar className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{balance.leave_types.name}</h3>
          <p className="text-xs text-slate-500">{balance.leave_types.code}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-900">{balance.total_leaves}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{balance.used_leaves}</p>
            <p className="text-xs text-slate-500">Used</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{balance.available_leaves}</p>
            <p className="text-xs text-slate-500">Available</p>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${colorGradient === 'blue' ? 'from-blue-500 to-blue-600' :
              colorGradient === 'red' ? 'from-red-500 to-red-600' :
              colorGradient === 'green' ? 'from-emerald-500 to-emerald-600' :
              colorGradient === 'purple' ? 'from-violet-500 to-violet-600' :
              'from-blue-500 to-blue-600'}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

function LeaveApplicationCard({ application }: { application: LeaveApplication }) {
  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      approved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border-2 ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-5 border-2 border-slate-200 rounded-xl hover:border-emerald-300 transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">{application.leave_types.name}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {new Date(application.from_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' → '}
            {new Date(application.to_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          {getStatusBadge(application.status)}
          <p className="text-sm font-bold text-slate-900 mt-2">{application.total_days} day(s)</p>
        </div>
      </div>
      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-700"><strong>Reason:</strong> {application.reason}</p>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
        <span>Applied: {new Date(application.applied_date).toLocaleDateString()}</span>
        {application.approved_date && (
          <span>
            {application.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(application.approved_date).toLocaleDateString()}
          </span>
        )}
      </div>
      {application.rejected_reason && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-900"><strong>Rejection Reason:</strong> {application.rejected_reason}</p>
        </div>
      )}
    </div>
  );
}

function PendingApplicationCard({ application, onApprove, onReject }: {
  application: any;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    onReject(application.id, rejectReason);
    setShowRejectModal(false);
    setRejectReason('');
  };

  return (
    <>
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">Reject Leave Application</h3>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Please provide reason for rejection"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 border-2 border-amber-200 bg-amber-50 rounded-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              {application.employees.first_name} {application.employees.last_name}
              <span className="text-sm text-slate-600 ml-2">({application.employees.employee_code})</span>
            </h3>
            <p className="text-sm font-semibold text-emerald-600 mt-1">{application.leave_types.name}</p>
            <p className="text-sm text-slate-600 mt-1">
              {new Date(application.from_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(application.to_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{application.total_days} day(s)</p>
        </div>
        <div className="p-3 bg-white rounded-lg mb-3">
          <p className="text-sm text-slate-700"><strong>Reason:</strong> {application.reason}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onApprove(application.id)}
            className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-emerald-800 flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            className="flex-1 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        </div>
      </div>
    </>
  );
}
