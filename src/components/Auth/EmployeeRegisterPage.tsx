import { useState, useEffect } from 'react';
import { Building2, Mail, Lock, User, CheckCircle, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { validatePassword, getPasswordStrengthColor } from '../../lib/passwordValidation';

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function EmployeeRegisterPage() {
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationData, setInvitationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [passwordValidation, setPasswordValidation] = useState(validatePassword(''));
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setInvitationCode(code);
      verifyInvitationCode(code);
    }
  }, []);

  const verifyInvitationCode = async (code: string) => {
    setVerifying(true);
    try {
      const { data, error } = await supabase
        .from('employee_invitations')
        .select(`
          *,
          employees (
            first_name,
            last_name,
            company_email,
            employee_code
          ),
          organizations (
            name
          )
        `)
        .eq('invitation_code', code)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setAlertModal({
          type: 'error',
          title: 'Invalid Invitation',
          message: 'This invitation link is invalid or has expired. Please contact your HR department.'
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setAlertModal({
          type: 'error',
          title: 'Invitation Expired',
          message: 'This invitation link has expired. Please request a new invitation from your HR department.'
        });
        return;
      }

      setInvitationData(data);
      setFormData({
        ...formData,
        email: data.email,
        fullName: `${data.employees.first_name} ${data.employees.last_name}`
      });
    } catch (error) {
      console.error('Error verifying invitation:', error);
      setAlertModal({
        type: 'error',
        title: 'Verification Failed',
        message: 'Failed to verify invitation code. Please try again.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitationData) {
      setAlertModal({
        type: 'error',
        title: 'No Invitation',
        message: 'Please enter a valid invitation code.'
      });
      return;
    }

    if (formData.password.length < 6) {
      setAlertModal({
        type: 'error',
        title: 'Invalid Password',
        message: 'Password must be at least 6 characters long.'
      });
      return;
    }

    const validation = validatePassword(formData.password);
    if (!validation.isValid) {
      setAlertModal({
        type: 'error',
        title: 'Invalid Password',
        message: validation.errors.join('. ')
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setAlertModal({
        type: 'error',
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please try again.'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('User registration failed');
      }

      const { data: linkResult, error: linkError } = await supabase.rpc('link_employee_to_user', {
        invitation_code_param: invitationCode,
        user_id_param: authData.user.id
      });

      if (linkError) throw linkError;

      if (!linkResult.success) {
        throw new Error(linkResult.error || 'Failed to link employee account');
      }

      await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          full_name: formData.fullName,
          email: formData.email
        });

      setAlertModal({
        type: 'success',
        title: 'Registration Successful!',
        message: `Welcome to ${invitationData.organizations.name}! Your account has been created successfully. Redirecting to login...`
      });

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('Registration error:', error);
      setAlertModal({
        type: 'error',
        title: 'Registration Failed',
        message: error.message || 'Failed to complete registration. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invitationCode.trim()) {
      verifyInvitationCode(invitationCode.trim());
    }
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
                  {alertModal.type === 'info' && <Mail className="h-8 w-8 text-white" />}
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

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-4">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Employee Registration</h1>
            <p className="text-slate-600">Join your organization using your invitation link</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            {!invitationData ? (
              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Invitation Code
                  </label>
                  <input
                    type="text"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value)}
                    placeholder="Enter your invitation code"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    You should have received this code from your HR department
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifying || !invitationCode.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            ) : (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-4 mb-6 border border-blue-100">
                  <p className="text-sm text-slate-600 mb-1">You're joining:</p>
                  <p className="text-lg font-bold text-slate-900">{invitationData.organizations.name}</p>
                  <p className="text-sm text-slate-600 mt-2">
                    Employee Code: <span className="font-semibold text-slate-900">{invitationData.employees.employee_code}</span>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.fullName}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="email"
                        value={formData.email}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => {
                          const newPassword = e.target.value;
                          setFormData({ ...formData, password: newPassword });
                          setPasswordValidation(validatePassword(newPassword));
                        }}
                        placeholder="Create a strong password"
                        className="w-full pl-10 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${getPasswordStrengthColor(passwordValidation.strength)}`}>
                            {passwordValidation.strength.toUpperCase()}
                          </div>
                        </div>
                        {passwordValidation.errors.length > 0 && (
                          <ul className="text-xs text-red-600 space-y-1">
                            {passwordValidation.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        className="w-full pl-10 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Complete Registration
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{' '}
                <button
                  onClick={() => window.location.href = '/'}
                  className="text-blue-600 font-semibold hover:text-blue-700"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
