import { useEffect, useState } from 'react';
import { User, Briefcase, DollarSign, FileText, Mail, Phone, MapPin, Calendar, Building, Sparkles, Download, Eye, Edit, Save, X, Lock, Camera, CheckCircle, AlertCircle, Clock, TrendingUp, Calendar as CalendarIcon, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SalaryComponent {
  id: string;
  component_id: string;
  amount: number;
  salary_components: {
    name: string;
    code: string;
    type: 'earning' | 'deduction';
  };
}

interface OfferLetter {
  id: string;
  offer_date: string;
  joining_date: string;
  ctc_annual: number;
  status: string;
  pdf_url?: string;
}

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  thisMonth: number;
}

interface LeaveStats {
  totalAvailable: number;
  totalTaken: number;
  pending: number;
}

export function EmployeeProfilePage() {
  const { membership, organization, user } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [salaryStructure, setSalaryStructure] = useState<SalaryComponent[]>([]);
  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({ totalPresent: 0, totalAbsent: 0, totalLate: 0, thisMonth: 0 });
  const [leaveStats, setLeaveStats] = useState<LeaveStats>({ totalAvailable: 0, totalTaken: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (membership?.role && ['admin', 'hr'].includes(membership.role)) {
      setIsAdmin(true);
    }
    loadData();
  }, [membership, user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserProfile(profile);

      if (membership?.employee_id) {
        await loadEmployeeData();
        await loadAttendanceStats();
        await loadLeaveStats();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeData = async () => {
    if (!membership?.employee_id) return;

    try {
      const { data: empData } = await supabase
        .from('employees')
        .select(`
          *,
          departments (name),
          designations (title),
          branches (name, city)
        `)
        .eq('id', membership.employee_id)
        .single();

      setEmployee(empData);
      setEditFormData(empData);

      const { data: salaryData } = await supabase
        .from('salary_structures')
        .select(`
          *,
          salary_components (name, code, type)
        `)
        .eq('employee_id', membership.employee_id)
        .eq('is_active', true)
        .order('salary_components(type)', { ascending: false });

      setSalaryStructure(salaryData || []);

      const { data: offerData } = await supabase
        .from('offer_letters')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .order('created_at', { ascending: false });

      setOfferLetters(offerData || []);
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  };

  const loadAttendanceStats = async () => {
    if (!membership?.employee_id) return;

    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .gte('attendance_date', startOfMonth)
        .lte('attendance_date', today);

      const present = data?.filter(r => r.status === 'present').length || 0;
      const absent = data?.filter(r => r.status === 'absent').length || 0;
      const late = data?.filter(r => {
        if (!r.check_in_time) return false;
        const checkInTime = new Date(r.check_in_time);
        const hours = checkInTime.getHours();
        const minutes = checkInTime.getMinutes();
        return hours > 9 || (hours === 9 && minutes > 30);
      }).length || 0;

      setAttendanceStats({
        totalPresent: present,
        totalAbsent: absent,
        totalLate: late,
        thisMonth: data?.length || 0
      });
    } catch (error) {
      console.error('Error loading attendance stats:', error);
    }
  };

  const loadLeaveStats = async () => {
    if (!membership?.employee_id) return;

    try {
      const { data: balances } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .eq('year', new Date().getFullYear());

      const { data: applications } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('employee_id', membership.employee_id);

      const available = balances?.reduce((sum, b) => sum + Number(b.available_leaves), 0) || 0;
      const taken = applications?.filter(a => a.status === 'approved').reduce((sum, a) => sum + Number(a.total_days), 0) || 0;
      const pending = applications?.filter(a => a.status === 'pending').length || 0;

      setLeaveStats({
        totalAvailable: available,
        totalTaken: taken,
        pending: pending
      });
    } catch (error) {
      console.error('Error loading leave stats:', error);
    }
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      setEditFormData(employee);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (field: string, value: any) => {
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleSaveProfile = async () => {
    if (!membership?.employee_id) return;

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          personal_email: editFormData.personal_email,
          mobile_number: editFormData.mobile_number,
          alternate_number: editFormData.alternate_number,
          current_address: editFormData.current_address,
          city: editFormData.city,
          state: editFormData.state,
          pincode: editFormData.pincode,
          updated_at: new Date().toISOString()
        })
        .eq('id', membership.employee_id);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully.'
      });

      setIsEditMode(false);
      await loadEmployeeData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setAlertModal({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update profile: ' + error.message
      });
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword.length < 6) {
      setAlertModal({
        type: 'error',
        title: 'Invalid Password',
        message: 'Password must be at least 6 characters long.'
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setAlertModal({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirm password do not match.'
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been changed successfully.'
      });

      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      setAlertModal({
        type: 'error',
        title: 'Password Change Failed',
        message: error.message || 'Failed to change password.'
      });
    }
  };

  const calculateTotals = () => {
    const earnings = salaryStructure
      .filter(s => s.salary_components.type === 'earning')
      .reduce((sum, s) => sum + parseFloat(s.amount.toString()), 0);

    const deductions = salaryStructure
      .filter(s => s.salary_components.type === 'deduction')
      .reduce((sum, s) => sum + parseFloat(s.amount.toString()), 0);

    const netSalary = earnings - deductions;

    return { earnings, deductions, netSalary };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <User className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
        </div>
      </div>
    );
  }

  const isEmployee = !employee;
  const displayName = employee
    ? `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim()
    : userProfile?.full_name || user?.email || 'User';

  const totals = employee ? calculateTotals() : { earnings: 0, deductions: 0, netSalary: 0 };

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
                  {alertModal.type === 'info' && <User className="h-8 w-8 text-white" />}
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

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Change Password</h3>
                </div>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter new password"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all"
                >
                  Change Password
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
              <User className="h-8 w-8 text-blue-600" />
              My Profile
            </h1>
            <p className="text-slate-600 mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              View and manage your information
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </button>
            {employee && (
              <button
                onClick={isEditMode ? handleSaveProfile : handleEditToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  isEditMode
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {isEditMode ? (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {employee && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon={Clock}
              label="Present Days"
              value={attendanceStats.totalPresent.toString()}
              color="from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={CalendarIcon}
              label="Leaves Taken"
              value={leaveStats.totalTaken.toString()}
              color="from-blue-500 to-blue-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Late Arrivals"
              value={attendanceStats.totalLate.toString()}
              color="from-amber-500 to-amber-600"
            />
            <StatCard
              icon={Award}
              label="Leave Balance"
              value={leaveStats.totalAvailable.toString()}
              color="from-violet-500 to-violet-600"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                      <span className="text-4xl font-bold text-blue-600">
                        {displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <button className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-lg hover:bg-blue-50 transition-colors">
                      <Camera className="h-4 w-4 text-blue-600" />
                    </button>
                  </div>
                  <div className="text-white">
                    <h2 className="text-3xl font-bold mb-2">{displayName}</h2>
                    {employee && (
                      <>
                        <p className="text-blue-100 text-lg">{employee.designations?.title || 'N/A'}</p>
                        <p className="text-blue-200 text-sm mt-1">{employee.employee_code}</p>
                      </>
                    )}
                    {!employee && (
                      <p className="text-blue-100 text-lg">{membership?.role.toUpperCase() || 'User'}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {employee ? (
                  <>
                    <InfoItem icon={Mail} label="Company Email" value={employee.company_email || 'N/A'} />
                    {isEditMode ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-blue-50 rounded-lg">
                          <Mail className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 mb-1">Personal Email</p>
                          <input
                            type="email"
                            value={editFormData.personal_email || ''}
                            onChange={(e) => handleEditChange('personal_email', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <InfoItem icon={Mail} label="Personal Email" value={employee.personal_email || 'N/A'} />
                    )}
                    {isEditMode ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-blue-50 rounded-lg">
                          <Phone className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 mb-1">Mobile</p>
                          <input
                            type="tel"
                            value={editFormData.mobile_number || ''}
                            onChange={(e) => handleEditChange('mobile_number', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <InfoItem icon={Phone} label="Mobile" value={employee.mobile_number || 'N/A'} />
                    )}
                    {isEditMode ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-blue-50 rounded-lg">
                          <Phone className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 mb-1">Alternate</p>
                          <input
                            type="tel"
                            value={editFormData.alternate_number || ''}
                            onChange={(e) => handleEditChange('alternate_number', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <InfoItem icon={Phone} label="Alternate" value={employee.alternate_number || 'N/A'} />
                    )}
                    <InfoItem icon={Building} label="Department" value={employee.departments?.name || 'N/A'} />
                    <InfoItem icon={MapPin} label="Branch" value={employee.branches?.name || 'N/A'} />
                    <InfoItem icon={Calendar} label="Date of Joining" value={employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : 'N/A'} />
                    <InfoItem icon={Calendar} label="Date of Birth" value={employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : 'N/A'} />
                  </>
                ) : (
                  <>
                    <InfoItem icon={Mail} label="Email" value={user?.email || 'N/A'} />
                    <InfoItem icon={User} label="Full Name" value={userProfile?.full_name || 'N/A'} />
                    <InfoItem icon={Building} label="Organization" value={organization?.name || 'N/A'} />
                    <InfoItem icon={Briefcase} label="Role" value={membership?.role.toUpperCase() || 'N/A'} />
                  </>
                )}
              </div>
            </div>

            {employee && salaryStructure.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Salary Breakdown</h3>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    Monthly
                  </span>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                      <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
                      Earnings
                    </h4>
                    {salaryStructure
                      .filter(s => s.salary_components.type === 'earning')
                      .map(component => (
                        <div key={component.id} className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-slate-700 font-medium">{component.salary_components.name}</span>
                          <span className="text-slate-900 font-bold">{formatCurrency(parseFloat(component.amount.toString()))}</span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between p-4 bg-emerald-100 rounded-xl border-2 border-emerald-200">
                      <span className="text-emerald-800 font-bold">Gross Earnings</span>
                      <span className="text-emerald-900 font-bold text-lg">{formatCurrency(totals.earnings)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                      <span className="h-2 w-2 bg-red-500 rounded-full"></span>
                      Deductions
                    </h4>
                    {salaryStructure
                      .filter(s => s.salary_components.type === 'deduction')
                      .map(component => (
                        <div key={component.id} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                          <span className="text-slate-700 font-medium">{component.salary_components.name}</span>
                          <span className="text-slate-900 font-bold">-{formatCurrency(parseFloat(component.amount.toString()))}</span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between p-4 bg-red-100 rounded-xl border-2 border-red-200">
                      <span className="text-red-800 font-bold">Total Deductions</span>
                      <span className="text-red-900 font-bold text-lg">-{formatCurrency(totals.deductions)}</span>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl text-white shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 mb-1">Net Monthly Salary</p>
                        <p className="text-3xl font-bold">{formatCurrency(totals.netSalary)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-100 mb-1">Annual CTC</p>
                        <p className="text-2xl font-bold">{formatCurrency(totals.earnings * 12)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {employee && (
              <>
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold">Employment Details</h3>
                  </div>
                  <div className="space-y-4">
                    <DetailItem label="Employment Type" value={employee.employment_type?.replace('_', ' ').toUpperCase() || 'N/A'} />
                    <DetailItem label="Status" value={employee.employment_status?.replace('_', ' ').toUpperCase() || 'N/A'} />
                    <DetailItem label="Blood Group" value={employee.blood_group || 'N/A'} />
                    <DetailItem label="Gender" value={employee.gender?.toUpperCase() || 'N/A'} />
                    <DetailItem label="Marital Status" value={employee.marital_status?.replace('_', ' ').toUpperCase() || 'N/A'} />
                  </div>
                </div>

                {offerLetters.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Offer Letters</h3>
                    </div>

                    <div className="space-y-3">
                      {offerLetters.map(letter => (
                        <div key={letter.id} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:border-violet-300 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {new Date(letter.offer_date).toLocaleDateString()}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              letter.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                              letter.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {letter.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mb-3">
                            CTC: {formatCurrency(parseFloat(letter.ctc_annual.toString()))}
                          </p>
                          <div className="flex gap-2">
                            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors text-xs font-medium">
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                            {letter.pdf_url && (
                              <button className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                                <Download className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Address</h3>
                  </div>
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Current Address</label>
                        <textarea
                          value={editFormData.current_address || ''}
                          onChange={(e) => handleEditChange('current_address', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">City</label>
                          <input
                            type="text"
                            value={editFormData.city || ''}
                            onChange={(e) => handleEditChange('city', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">State</label>
                          <input
                            type="text"
                            value={editFormData.state || ''}
                            onChange={(e) => handleEditChange('state', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Pincode</label>
                        <input
                          type="text"
                          value={editFormData.pincode || ''}
                          onChange={(e) => handleEditChange('pincode', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-slate-600">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Current Address</p>
                        <p className="font-medium text-slate-900">{employee.current_address || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">City, State</p>
                        <p className="font-medium text-slate-900">{employee.city || 'N/A'}, {employee.state || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Pincode</p>
                        <p className="font-medium text-slate-900">{employee.pincode || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 p-2 bg-blue-50 rounded-lg">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
      <span className="text-sm text-white/70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-slate-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
