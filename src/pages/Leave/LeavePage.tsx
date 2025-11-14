import { useEffect, useState } from 'react';
import { Calendar, Plus, X, Send, CheckCircle, AlertCircle, Clock, FileText, Check, XCircle, Sparkles, Info, AlertTriangle, TrendingUp, Users, Download, Filter, SortAsc } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScopeBar } from '../../components/Scope/ScopeBar';

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
  applied_at: string;
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
  half_day_period?: 'morning' | 'afternoon' | '';
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
  // Manager/Owner views
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedDepartment] = useState<string>('all');
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [showApproveModal, setShowApproveModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [approveRemark, setApproveRemark] = useState('');
  const [policyQuotas, setPolicyQuotas] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState<ApplyLeaveForm>({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: '',
    half_day: false,
    contact_number: '',
    half_day_period: ''
  });
  
  // Owner Dashboard Metrics
  const [ownerMetrics, setOwnerMetrics] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    currentlyOnLeave: 0,
    upcomingLeaves: 0
  });
  const [monthlyTrends, setMonthlyTrends] = useState<{ month: string; count: number }[]>([]);
  const [leaveTypeDistribution, setLeaveTypeDistribution] = useState<{ type: string; count: number; color: string }[]>([]);
  
  // Advanced Filters
  const [filters, setFilters] = useState({
    status: 'all',
    leaveType: 'all',
    department: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [sortBy, setSortBy] = useState<'date' | 'employee' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Policy Configuration
  const [showPolicyConfig, setShowPolicyConfig] = useState(false);

  const isManager = membership?.role && ['owner','admin', 'hr', 'manager'].includes(membership.role);

  useEffect(() => {
    loadLeaveData();
  }, [membership, organization]);

  useEffect(() => {
    // Realtime updates for leave applications
    const channel = supabase
      .channel('realtime-leaves')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_applications' },
        async () => {
          try {
            if (membership?.employee_id) {
              await Promise.all([loadLeaveApplications(), loadLeaveBalances()]);
            }
            if (isManager) {
              await Promise.all([
                loadPendingApplications(),
                loadAllRequests(),
                loadOwnerMetrics()
              ]);
            }
          } catch (e) {
            console.error('Realtime reload failed:', e);
          }
        }
      )
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  }, [membership?.employee_id, isManager, selectedDepartment]);
  const loadLeaveData = async () => {
    try {
      await Promise.all([
        loadLeaveTypes(),
        loadLeaveBalances(),
        loadLeaveApplications(),
        isManager && loadPendingApplications(),
        isManager && loadDepartments(),
        isManager && loadAllRequests(),
        isManager && loadOwnerMetrics()
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
        .order('applied_at', { ascending: false })
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
        .order('applied_at', { ascending: false });
      setPendingApplications(data || []);
    } catch (error) {
      console.error('Error loading pending applications:', error);
    }
  };

  const loadDepartments = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartments([]);
    }
  };

  const loadOwnerMetrics = async () => {
    if (!organization?.id || !isManager) return;
    
    try {
      // Load all leave applications for the organization
      const { data: allLeaves, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          leave_types (*),
          employees!inner(organization_id)
        `)
        .eq('employees.organization_id', organization.id);
      
      if (error) throw error;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate metrics
      const totalRequests = allLeaves?.length || 0;
      const pendingRequests = allLeaves?.filter(l => l.status === 'pending').length || 0;
      const approvedRequests = allLeaves?.filter(l => l.status === 'approved').length || 0;
      const rejectedRequests = allLeaves?.filter(l => l.status === 'rejected').length || 0;
      
      // Currently on leave (approved leaves where today is between from_date and to_date)
      const currentlyOnLeave = allLeaves?.filter(l => {
        if (l.status !== 'approved') return false;
        const from = new Date(l.from_date);
        const to = new Date(l.to_date);
        from.setHours(0, 0, 0, 0);
        to.setHours(0, 0, 0, 0);
        return today >= from && today <= to;
      }).length || 0;
      
      // Upcoming leaves (approved leaves starting after today)
      const upcomingLeaves = allLeaves?.filter(l => {
        if (l.status !== 'approved') return false;
        const from = new Date(l.from_date);
        from.setHours(0, 0, 0, 0);
        return from > today;
      }).length || 0;
      
      setOwnerMetrics({
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        currentlyOnLeave,
        upcomingLeaves
      });
      
      // Calculate monthly trends (last 6 months)
      const monthlyData: Record<string, number> = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[key] = 0;
      }
      
      allLeaves?.forEach(leave => {
        const appliedDate = new Date(leave.applied_at);
        const key = `${monthNames[appliedDate.getMonth()]} ${appliedDate.getFullYear()}`;
        if (monthlyData.hasOwnProperty(key)) {
          monthlyData[key]++;
        }
      });
      
      setMonthlyTrends(
        Object.entries(monthlyData).map(([month, count]) => ({ month, count }))
      );
      
      // Calculate leave type distribution
      const typeDistribution: Record<string, { count: number; color: string }> = {};
      allLeaves?.forEach(leave => {
        const typeName = leave.leave_types?.name || 'Unknown';
        const typeColor = leave.leave_types?.color || '#6B7280';
        if (!typeDistribution[typeName]) {
          typeDistribution[typeName] = { count: 0, color: typeColor };
        }
        typeDistribution[typeName].count++;
      });
      
      setLeaveTypeDistribution(
        Object.entries(typeDistribution).map(([type, data]) => ({
          type,
          count: data.count,
          color: data.color
        }))
      );
      
    } catch (error) {
      console.error('Error loading owner metrics:', error);
    }
  };

  const loadAllRequests = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          leave_types (*),
          employees:employees!inner(
            id, first_name, last_name, employee_code, department_id,
            departments:departments!employees_department_id_fkey ( id, name )
          )
        `)
        .eq('employees.organization_id', organization.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      setAllRequests(data || []);
    } catch (error) {
      console.error('Error loading all leave requests:', error);
      setAllRequests([]);
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

    if (formData.half_day && !formData.half_day_period) return 'Select the half-day period';

    const days = calculateDays();
    const balance = leaveBalances.find(b => b.leave_type_id === formData.leave_type_id);
    if (balance && days > balance.available_leaves) {
      return `Insufficient leave balance. Available: ${balance.available_leaves} days`;
    }

    return null;
  };

  const hasOverlap = async (): Promise<string | null> => {
    if (!membership?.employee_id) return null;
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('id, from_date, to_date, status')
        .eq('employee_id', membership.employee_id)
        .in('status', ['pending', 'approved'])
        .lte('from_date', formData.to_date)
        .gte('to_date', formData.from_date)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        return 'You already have a leave that overlaps with the selected date range.';
      }
      return null;
    } catch (e: any) {
      console.error('Error checking overlap:', e);
      return null;
    }
  };

  const adjustLeaveBalance = async (employeeId: string, leaveTypeId: string, year: number, deltas: { pending?: number; used?: number }) => {
    try {
      const { data: rows, error: selErr } = await supabase
        .from('leave_balances')
        .select('id, total_quota, used_leaves, pending_leaves')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveTypeId)
        .eq('year', year)
        .limit(1);
      if (selErr) throw selErr;

      if (!rows || rows.length === 0) {
        const { error: insErr } = await supabase
          .from('leave_balances')
          .insert({ employee_id: employeeId, leave_type_id: leaveTypeId, year, total_quota: 0, used_leaves: deltas.used || 0, pending_leaves: deltas.pending || 0 });
        if (insErr) throw insErr;
      } else {
        const current = rows[0];
        const payload: any = {};
        if (typeof deltas.pending === 'number') payload.pending_leaves = Number(current.pending_leaves || 0) + deltas.pending;
        if (typeof deltas.used === 'number') payload.used_leaves = Number(current.used_leaves || 0) + deltas.used;
        if (Object.keys(payload).length > 0) {
          const { error: updErr } = await supabase
            .from('leave_balances')
            .update(payload)
            .eq('id', current.id);
          if (updErr) throw updErr;
        }
      }
    } catch (e) {
      console.error('Error adjusting leave balance:', e);
    }
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
      const overlapError = await hasOverlap();
      if (overlapError) {
        setAlertModal({ type: 'error', title: 'Overlap Detected', message: overlapError });
        return;
      }

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
          half_day_period: formData.half_day ? (formData.half_day_period || null) : null,
          status: 'pending',
          applied_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Increase pending balance
      const year = new Date(formData.from_date).getFullYear();
      await adjustLeaveBalance(membership.employee_id, formData.leave_type_id, year, { pending: Number(days) });

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
        contact_number: '',
        half_day_period: ''
      });
      setSelectedLeaveType(null);

      await Promise.all([loadLeaveApplications(), loadLeaveBalances()]);
    } catch (error: any) {
      console.error('Error applying leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Application Failed',
        message: error.message || 'Failed to submit leave application'
      });
    }
  };

  // Approval handled via modal with optional remark

  const handleApproveWithRemark = async () => {
    if (!membership?.user_id || !showApproveModal.id) return;

    try {
      // fetch application to know totals
      const { data: apps, error: appErr } = await supabase
        .from('leave_applications')
        .select('id, employee_id, leave_type_id, total_days, from_date')
        .eq('id', showApproveModal.id)
        .limit(1);
      if (appErr) throw appErr;

      const update: any = {
        status: 'approved',
        approved_by: membership.user_id,
        approved_date: new Date().toISOString(),
      };
      if (approveRemark.trim()) update.remarks = approveRemark.trim();

      const { error } = await supabase
        .from('leave_applications')
        .update(update)
        .eq('id', showApproveModal.id);

      if (error) throw error;

      // adjust balances: -pending, +used
      const app = apps && apps[0];
      if (app) {
        const year = new Date(app.from_date).getFullYear();
        await adjustLeaveBalance(app.employee_id, app.leave_type_id, year, { pending: -Number(app.total_days), used: Number(app.total_days) });
      }

      setAlertModal({
        type: 'success',
        title: 'Leave Approved',
        message: 'Leave application has been approved successfully.'
      });

      setShowApproveModal({ open: false, id: null });
      setApproveRemark('');
      await Promise.all([
        loadPendingApplications(),
        loadLeaveApplications(),
        loadAllRequests()
      ]);
    } catch (error: any) {
      console.error('Error approving leave with remark:', error);
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
      // fetch app
      const { data: apps, error: appErr } = await supabase
        .from('leave_applications')
        .select('id, employee_id, leave_type_id, total_days, from_date')
        .eq('id', applicationId)
        .limit(1);
      if (appErr) throw appErr;

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

      // decrement pending
      const app = apps && apps[0];
      if (app) {
        const year = new Date(app.from_date).getFullYear();
        await adjustLeaveBalance(app.employee_id, app.leave_type_id, year, { pending: -Number(app.total_days) });
      }

      setAlertModal({
        type: 'success',
        title: 'Leave Rejected',
        message: 'Leave application has been rejected.'
      });

      await loadPendingApplications();
      await loadLeaveApplications();
      await loadAllRequests();
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Rejection Failed',
        message: error.message || 'Failed to reject leave'
      });
    }
  };

  const handleCancel = async (applicationId: string) => {
    // Employee can cancel only pending applications
    try {
      const { data: apps, error: appErr } = await supabase
        .from('leave_applications')
        .select('id, employee_id, leave_type_id, total_days, from_date, status')
        .eq('id', applicationId)
        .eq('employee_id', membership?.employee_id || '')
        .limit(1);
      if (appErr) throw appErr;

      const { error } = await supabase
        .from('leave_applications')
        .update({ status: 'cancelled' })
        .eq('id', applicationId)
        .eq('status', 'pending')
        .eq('employee_id', membership?.employee_id || '');

      if (error) throw error;

      const app = apps && apps[0];
      if (app && app.status === 'pending') {
        const year = new Date(app.from_date).getFullYear();
        await adjustLeaveBalance(app.employee_id, app.leave_type_id, year, { pending: -Number(app.total_days) });
      }

      setAlertModal({
        type: 'success',
        title: 'Leave Cancelled',
        message: 'Your leave request has been cancelled.'
      });

      await Promise.all([loadLeaveApplications(), loadLeaveBalances()]);
    } catch (error: any) {
      console.error('Error cancelling leave:', error);
      setAlertModal({
        type: 'error',
        title: 'Cancellation Failed',
        message: error.message || 'Failed to cancel leave'
      });
    }
  };

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    setFormData({ ...formData, leave_type_id: leaveTypeId });
    const type = leaveTypes.find(t => t.id === leaveTypeId);
    setSelectedLeaveType(type || null);
  };

  const handleApplyQuotas = async () => {
    if (!organization?.id) return;
    try {
      // collect quotas
      const entries = Object.entries(policyQuotas).filter(([_, v]) => !isNaN(Number(v)) && Number(v) >= 0);
      if (entries.length === 0) {
        setAlertModal({ type: 'warning', title: 'No Quotas Set', message: 'Please enter at least one quota value to apply.' });
        return;
      }

      // fetch employees in org
      const { data: employees, error: empErr } = await supabase
        .from('employees')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('status', 'active');
      if (empErr) throw empErr;

      const employeeIds = (employees || []).map((e: any) => e.id);
      if (employeeIds.length === 0) {
        setAlertModal({ type: 'info', title: 'No Employees', message: 'No active employees found to apply quotas.' });
        return;
      }

      const year = new Date().getFullYear();
      // build rows for upsert
      const rows: any[] = [];
      for (const [typeId, quota] of entries) {
        for (const empId of employeeIds) {
          rows.push({ employee_id: empId, leave_type_id: typeId, year, total_quota: Number(quota) });
        }
      }

      // upsert in chunks to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('leave_balances')
          .upsert(chunk, { onConflict: 'employee_id,leave_type_id,year' });
        if (error) throw error;
      }

      setAlertModal({ type: 'success', title: 'Quotas Applied', message: 'Leave quotas have been applied to all active employees for the current year.' });
      await loadLeaveBalances();
    } catch (error: any) {
      console.error('Error applying quotas:', error);
      setAlertModal({ type: 'error', title: 'Failed to Apply Quotas', message: error.message || 'An error occurred while applying leave quotas.' });
    }
  };

  const exportToCSV = () => {
    if (!allRequests.length) return;
    
    // Apply filters
    let filteredData = [...allRequests];
    
    if (filters.status !== 'all') {
      filteredData = filteredData.filter(r => r.status === filters.status);
    }
    if (filters.leaveType !== 'all') {
      filteredData = filteredData.filter(r => r.leave_type_id === filters.leaveType);
    }
    if (filters.department !== 'all') {
      filteredData = filteredData.filter(r => r.employees?.department_id === filters.department);
    }
    if (filters.dateFrom) {
      filteredData = filteredData.filter(r => new Date(r.from_date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filteredData = filteredData.filter(r => new Date(r.to_date) <= new Date(filters.dateTo));
    }
    
    // Create CSV content
    const headers = ['Employee Name', 'Employee Code', 'Department', 'Leave Type', 'From Date', 'To Date', 'Total Days', 'Status', 'Applied Date', 'Reason'];
    const rows = filteredData.map(r => [
      `${r.employees?.first_name || ''} ${r.employees?.last_name || ''}`,
      r.employees?.employee_code || '',
      r.employees?.departments?.name || '',
      r.leave_types?.name || '',
      new Date(r.from_date).toLocaleDateString(),
      new Date(r.to_date).toLocaleDateString(),
      r.total_days,
      r.status,
      new Date(r.applied_at).toLocaleDateString(),
      `"${r.reason.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leave_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilteredAndSortedRequests = () => {
    let filtered = [...allRequests];
    
    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    if (filters.leaveType !== 'all') {
      filtered = filtered.filter(r => r.leave_type_id === filters.leaveType);
    }
    if (filters.department !== 'all') {
      filtered = filtered.filter(r => r.employees?.department_id === filters.department);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(r => new Date(r.from_date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(r => new Date(r.to_date) <= new Date(filters.dateTo));
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const aDate = new Date(a.applied_at).getTime();
        const bDate = new Date(b.applied_at).getTime();
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      } else if (sortBy === 'employee') {
        const aName = `${a.employees?.first_name} ${a.employees?.last_name}`.toLowerCase();
        const bName = `${b.employees?.first_name} ${b.employees?.last_name}`.toLowerCase();
        return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      } else if (sortBy === 'status') {
        return sortOrder === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
      }
      return 0;
    });
    
    return filtered;
  };

  // helper functions moved to card components

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
      <ScopeBar />
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

      {showApproveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Approve Leave</h3>
                <button onClick={() => setShowApproveModal({ open: false, id: null })} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">Optionally add a note for the employee:</p>
              <textarea
                value={approveRemark}
                onChange={(e) => setApproveRemark(e.target.value)}
                rows={4}
                placeholder="Remark (optional)"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveModal({ open: false, id: null })}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveWithRemark}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800"
                >
                  Approve
                </button>
              </div>
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
                {formData.half_day && (
                  <div className="mt-3">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Half-day period</label>
                    <select
                      value={formData.half_day_period || ''}
                      onChange={(e) => setFormData({ ...formData, half_day_period: (e.target.value as any) })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select period</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </select>
                  </div>
                )}
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

      {/* Policy Configuration Modal */}
      <PolicyConfigurationModal
        isOpen={showPolicyConfig}
        onClose={() => setShowPolicyConfig(false)}
        leaveTypes={leaveTypes}
        departments={departments}
        organization={organization}
      />

      <div className="space-y-6 animate-fadeIn">
        {/* Owner Metrics Dashboard */}
        {isManager && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  Leave Analytics Dashboard
                </h1>
                <p className="text-slate-600 mt-2">Complete HR-level view of all leave activities</p>
              </div>
            </div>

            {/* Overview Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <OwnerMetricCard
                icon={FileText}
                title="Total Requests"
                value={ownerMetrics.totalRequests}
                color="blue"
                subtitle="All time"
              />
              <OwnerMetricCard
                icon={Clock}
                title="Pending"
                value={ownerMetrics.pendingRequests}
                color="amber"
                subtitle="Awaiting approval"
              />
              <OwnerMetricCard
                icon={CheckCircle}
                title="Approved"
                value={ownerMetrics.approvedRequests}
                color="emerald"
                subtitle="Granted leaves"
              />
              <OwnerMetricCard
                icon={XCircle}
                title="Rejected"
                value={ownerMetrics.rejectedRequests}
                color="red"
                subtitle="Declined requests"
              />
              <OwnerMetricCard
                icon={Users}
                title="On Leave Today"
                value={ownerMetrics.currentlyOnLeave}
                color="purple"
                subtitle="Currently away"
              />
              <OwnerMetricCard
                icon={Calendar}
                title="Upcoming"
                value={ownerMetrics.upcomingLeaves}
                color="cyan"
                subtitle="Scheduled leaves"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthlyTrendsChart data={monthlyTrends} />
              <LeaveTypeDistributionChart data={leaveTypeDistribution} />
            </div>
          </div>
        )}

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
                  onApprove={(id) => setShowApproveModal({ open: true, id })}
                  onReject={handleReject}
                />
              ))}
            </div>
          </div>
        )}

        {isManager && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">All Leave Requests</h2>
                  <p className="text-sm text-slate-600">Organization-wide leave applications</p>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                disabled={allRequests.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            {/* Advanced Filters */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900">Advanced Filters</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type</label>
                  <select
                    value={filters.leaveType}
                    onChange={(e) => setFilters({ ...filters, leaveType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    {leaveTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <SortAsc className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-600">Sort By:</span>
                </div>
                <button
                  onClick={() => {
                    setSortBy('date');
                    setSortOrder(sortBy === 'date' && sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    sortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => {
                    setSortBy('employee');
                    setSortOrder(sortBy === 'employee' && sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    sortBy === 'employee' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Employee {sortBy === 'employee' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => {
                    setSortBy('status');
                    setSortOrder(sortBy === 'status' && sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    sortBy === 'status' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => setFilters({ status: 'all', leaveType: 'all', department: 'all', dateFrom: '', dateTo: '' })}
                  className="ml-auto px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="Total" value={getFilteredAndSortedRequests().length} color="blue" />
              <StatCard label="Approved" value={getFilteredAndSortedRequests().filter(r => r.status === 'approved').length} color="emerald" />
              <StatCard label="Pending" value={getFilteredAndSortedRequests().filter(r => r.status === 'pending').length} color="amber" />
            </div>

            {getFilteredAndSortedRequests().length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-semibold">No requests found</p>
                <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-sm text-slate-500 border-b">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">From</th>
                      <th className="py-3 px-4">To</th>
                      <th className="py-3 px-4">Days</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAndSortedRequests().slice(0, 100).map((r: any) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-slate-900">{r.employees.first_name} {r.employees.last_name}</p>
                            <p className="text-xs text-slate-500">{r.employees.employee_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.employees.departments?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{r.leave_types?.code}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{new Date(r.from_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-slate-700">{new Date(r.to_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-slate-700">{r.total_days}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : r.status === 'cancelled' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowApproveModal({ open: true, id: r.id })}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                              >Approve</button>
                              <button
                                onClick={() => {
                                  const reason = window.prompt('Reason for rejection?');
                                  if (reason && reason.trim()) handleReject(r.id, reason.trim());
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                              >Reject</button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                <LeaveApplicationCard key={app.id} application={app} onCancel={handleCancel} />
              ))}
            </div>
          )}
        </div>

        {/* Leave Calendar View */}
        {isManager && allRequests.length > 0 && (
          <LeaveCalendarView
            leaves={allRequests}
            departments={departments}
            selectedDept={filters.department}
            onDeptChange={(deptId) => setFilters({ ...filters, department: deptId })}
          />
        )}

        {isManager && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Leave Policies (Quotas)</h2>
                  <p className="text-sm text-slate-600">Set yearly quota per leave type and apply to all active employees</p>
                </div>
              </div>
              <button
                onClick={() => setShowPolicyConfig(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl"
              >
                <Sparkles className="h-4 w-4" />
                Configure Policy
              </button>
            </div>

            {leaveTypes.length === 0 ? (
              <p className="text-slate-500">No leave types configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-sm text-slate-500 border-b">
                      <th className="py-3 px-4">Leave Type</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Yearly Quota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.map((lt) => (
                      <tr key={lt.id} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-semibold text-slate-900">{lt.name}</td>
                        <td className="py-3 px-4 text-slate-600">{lt.code}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={policyQuotas[lt.id] ?? ''}
                            onChange={(e) => setPolicyQuotas({ ...policyQuotas, [lt.id]: e.target.value === '' ? (undefined as any) : Number(e.target.value) })}
                            placeholder="e.g., 12"
                            className="w-32 px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleApplyQuotas}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800"
              >
                Apply to all employees (current year)
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Owner Metrics Dashboard Components
function OwnerMetricCard({ icon: Icon, title, value, color, subtitle }: {
  icon: any;
  title: string;
  value: number;
  color: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    cyan: 'from-cyan-500 to-cyan-600'
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-all">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-600 mb-3">{title}</p>
          <p className="text-4xl font-bold text-slate-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
        </div>
        <div className={`h-16 w-16 bg-gradient-to-br ${colorClasses[color] || colorClasses.blue} rounded-2xl flex items-center justify-center flex-shrink-0 ml-4`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
      </div>
    </div>
  );
}

function MonthlyTrendsChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Monthly Leave Trends</h3>
          <p className="text-sm text-slate-600">Last 6 months leave applications</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="w-20 text-sm font-semibold text-slate-700">{item.month}</div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${(item.count / maxCount) * 100}%`, minWidth: item.count > 0 ? '30px' : '0' }}
                >
                  {item.count > 0 && <span className="text-xs font-bold text-white">{item.count}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveTypeDistributionChart({ data }: { data: { type: string; count: number; color: string }[] }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Calendar className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Leave Type Distribution</h3>
          <p className="text-sm text-slate-600">Breakdown by leave type</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.count / total * 100).toFixed(1) : 0;
          return (
            <div key={index} className="flex items-center gap-4">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900">{item.type}</span>
                  <span className="text-sm font-bold text-slate-700">{item.count} ({percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Total Applications</span>
          <span className="text-lg font-bold text-slate-900">{total}</span>
        </div>
      </div>
    </div>
  );
}

function LeaveCalendarView({ leaves, departments, selectedDept, onDeptChange }: {
  leaves: any[];
  departments: { id: string; name: string }[];
  selectedDept: string;
  onDeptChange: (deptId: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const today = () => {
    setCurrentMonth(new Date());
  };
  
  // Filter leaves for current month and department
  const filteredLeaves = leaves.filter(leave => {
    if (leave.status !== 'approved') return false;
    
    const leaveFrom = new Date(leave.from_date);
    const leaveTo = new Date(leave.to_date);
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const overlaps = !(leaveTo < monthStart || leaveFrom > monthEnd);
    
    if (selectedDept !== 'all' && leave.employees?.department_id !== selectedDept) {
      return false;
    }
    
    return overlaps;
  });
  
  const getLeavesForDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    
    return filteredLeaves.filter(leave => {
      const leaveFrom = new Date(leave.from_date);
      const leaveTo = new Date(leave.to_date);
      leaveFrom.setHours(0, 0, 0, 0);
      leaveTo.setHours(0, 0, 0, 0);
      
      return date >= leaveFrom && date <= leaveTo;
    });
  };
  
  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && 
           currentMonth.getMonth() === now.getMonth() && 
           currentMonth.getFullYear() === now.getFullYear();
  };
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="p-2 border border-slate-100"></div>);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayLeaves = getLeavesForDay(day);
    const isCurrentDay = isToday(day);
    
    days.push(
      <div 
        key={day} 
        className={`min-h-[100px] p-2 border border-slate-200 ${isCurrentDay ? 'bg-blue-50 border-blue-300' : 'bg-white'} hover:bg-slate-50 transition-colors`}
      >
        <div className={`text-sm font-semibold mb-1 ${isCurrentDay ? 'text-blue-600' : 'text-slate-700'}`}>
          {day}
          {isCurrentDay && <span className="ml-1 text-xs">(Today)</span>}
        </div>
        <div className="space-y-1">
          {dayLeaves.slice(0, 3).map((leave, idx) => (
            <div
              key={idx}
              className="px-2 py-1 rounded text-xs font-semibold truncate"
              style={{ 
                backgroundColor: `${leave.leave_types?.color}20`,
                color: leave.leave_types?.color || '#6B7280',
                borderLeft: `3px solid ${leave.leave_types?.color || '#6B7280'}`
              }}
              title={`${leave.employees?.first_name} ${leave.employees?.last_name} - ${leave.leave_types?.name}`}
            >
              {leave.employees?.first_name} {leave.employees?.last_name?.charAt(0)}.
            </div>
          ))}
          {dayLeaves.length > 3 && (
            <div className="text-xs text-slate-500 font-semibold">
              +{dayLeaves.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Leave Calendar</h2>
            <p className="text-sm text-slate-600">Monthly view of approved leaves</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => onDeptChange(e.target.value)}
            className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-slate-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={today}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-semibold text-sm transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-0 border border-slate-200 rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 bg-slate-100 border-b-2 border-slate-300 text-center font-bold text-slate-700 text-sm">
            {day}
          </div>
        ))}
        {days}
      </div>
      
      <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border-2 border-blue-300 rounded"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-50 border border-slate-200 rounded"></div>
          <span>Regular day</span>
        </div>
        <span className="ml-auto text-slate-500">
          {filteredLeaves.length} approved leave(s) this month
        </span>
      </div>
    </div>
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

function LeaveApplicationCard({ application, onCancel }: { application: LeaveApplication; onCancel?: (id: string) => void }) {
  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
      approved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
      cancelled: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: XCircle },
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
        <span>Applied: {new Date(application.applied_at).toLocaleDateString()}</span>
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
      {application.status === 'pending' && onCancel && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onCancel(application.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancel Request
          </button>
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

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'emerald' | 'amber' }) {
  const colorMap: any = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
  };
  return (
    <div className="p-4 border-2 border-slate-200 rounded-xl">
      <p className="text-sm text-slate-600">{label}</p>
      <div className={`mt-2 inline-flex items-center justify-center h-10 px-4 rounded-lg text-white font-bold bg-gradient-to-r ${colorMap[color]}`}>
        {value}
      </div>
    </div>
  );
}

function PolicyConfigurationModal({ 
  isOpen, 
  onClose, 
  leaveTypes, 
  departments,
  organization 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  leaveTypes: LeaveType[];
  departments: { id: string; name: string }[];
  organization: any;
}) {
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [policyData, setPolicyData] = useState({
    yearlyQuota: '',
    carryForwardEnabled: false,
    maxCarryForward: '',
    minNoticeDays: '',
    maxConsecutiveDays: '',
    allowHalfDay: true
  });
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedLeaveType) {
      setAlertMessage({ type: 'error', message: 'Please select a leave type' });
      return;
    }

    setSaving(true);
    try {
      const policyPayload = {
        organization_id: organization?.id,
        leave_type_id: selectedLeaveType,
        department_id: selectedDepartment === 'all' ? null : selectedDepartment,
        yearly_quota: parseInt(policyData.yearlyQuota) || 0,
        carry_forward_enabled: policyData.carryForwardEnabled,
        max_carry_forward: policyData.carryForwardEnabled ? (parseInt(policyData.maxCarryForward) || 0) : 0,
        min_notice_days: parseInt(policyData.minNoticeDays) || 0,
        max_consecutive_days: parseInt(policyData.maxConsecutiveDays) || 0,
        allow_half_day: policyData.allowHalfDay,
        effective_from: new Date().toISOString().split('T')[0]
      };

      const { error } = await supabase
        .from('leave_policies')
        .upsert(policyPayload, { 
          onConflict: 'organization_id,leave_type_id,department_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      setAlertMessage({ type: 'success', message: 'Leave policy saved successfully!' });
      
      // Reset form after 1.5 seconds
      setTimeout(() => {
        setPolicyData({
          yearlyQuota: '',
          carryForwardEnabled: false,
          maxCarryForward: '',
          minNoticeDays: '',
          maxConsecutiveDays: '',
          allowHalfDay: true
        });
        setSelectedLeaveType('');
        setSelectedDepartment('all');
        setAlertMessage(null);
      }, 1500);
    } catch (error: any) {
      console.error('Error saving policy:', error);
      setAlertMessage({ type: 'error', message: error.message || 'Failed to save policy' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 animate-scaleIn">
        <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-white" />
              <h3 className="text-xl font-bold text-white">Leave Policy Configuration</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {alertMessage && (
            <div className={`p-4 rounded-xl border-2 ${
              alertMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <p className="font-semibold">{alertMessage.message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Leave Type <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLeaveType}
                onChange={(e) => setSelectedLeaveType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Department (Optional)
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Leave blank for organization-wide policy</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Yearly Quota (Days) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={policyData.yearlyQuota}
                onChange={(e) => setPolicyData({ ...policyData, yearlyQuota: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., 20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Minimum Notice Days
              </label>
              <input
                type="number"
                min="0"
                value={policyData.minNoticeDays}
                onChange={(e) => setPolicyData({ ...policyData, minNoticeDays: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., 3"
              />
              <p className="text-xs text-slate-500 mt-1">Days in advance required for application</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Max Consecutive Days
              </label>
              <input
                type="number"
                min="0"
                value={policyData.maxConsecutiveDays}
                onChange={(e) => setPolicyData({ ...policyData, maxConsecutiveDays: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., 10"
              />
              <p className="text-xs text-slate-500 mt-1">Maximum consecutive days allowed</p>
            </div>

            <div className="flex items-center gap-4 pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyData.allowHalfDay}
                  onChange={(e) => setPolicyData({ ...policyData, allowHalfDay: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-semibold text-slate-700">Allow Half Day</span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="carryForward"
                checked={policyData.carryForwardEnabled}
                onChange={(e) => setPolicyData({ ...policyData, carryForwardEnabled: e.target.checked })}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="carryForward" className="text-sm font-semibold text-slate-700 cursor-pointer">
                Enable Carry Forward to Next Year
              </label>
            </div>

            {policyData.carryForwardEnabled && (
              <div className="ml-8 mt-3">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Maximum Carry Forward Days
                </label>
                <input
                  type="number"
                  min="0"
                  value={policyData.maxCarryForward}
                  onChange={(e) => setPolicyData({ ...policyData, maxCarryForward: e.target.value })}
                  className="w-full md:w-64 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., 5"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum unused days that can be carried forward</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedLeaveType}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
