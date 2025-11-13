import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building, Lock, Mail, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor } from '../../lib/passwordValidation';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [formData, setFormData] = useState({
    organizationName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState(validatePassword(''));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validation = validatePassword(formData.password);
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    if (!formData.organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    setLoading(true);

    try {
      await signUp(formData.email, formData.password, formData.organizationName);
      // If signUp succeeds, show activation message and redirect to login
      setError('Activation mail has been sent. Please check your email to confirm your account.');
      setTimeout(() => {
        setError('');
        onSwitchToLogin();
      }, 3500);
    } catch (err: any) {
      // If error is "Email not confirmed" or similar, treat as activation mail sent
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('email not confirmed') || msg.includes('confirm your email')) {
        setError('Activation mail has been sent. Please check your email to confirm your account.');
        setTimeout(() => {
          setError('');
          onSwitchToLogin();
        }, 3500);
      } else {
        const message = err?.message || err?.error || JSON.stringify(err, Object.getOwnPropertyNames(err));
        setError(message || 'Failed to create account');
        console.error('Registration error (full):', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'password') {
      setPasswordValidation(validatePassword(value));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10">
            <h2 className="text-3xl font-bold text-white text-center">Start Your Free Trial</h2>
            <p className="text-blue-100 text-center mt-2">14-day trial, no credit card required</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-slate-700 mb-2">
                Organization Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Your Company Name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-900 mb-2">What you get:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Check className="h-4 w-4" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Check className="h-4 w-4" />
                  <span>Up to 25 employees</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Check className="h-4 w-4" />
                  <span>Full access to all features</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Check className="h-4 w-4" />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating your account...' : 'Start Free Trial'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-8">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
