import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError('Failed to send password reset email. Please check your email address.');
      console.error('Password reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-10">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white text-center">Check Your Email</h2>
              <p className="text-green-100 text-center mt-2">Password reset link sent successfully</p>
            </div>

            <div className="px-8 py-10 text-center">
              <p className="text-slate-600 mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
                Please check your email and follow the instructions to reset your password.
              </p>

              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Didn't receive the email? Check your spam folder or try again.
                </p>

                <button
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  className="w-full bg-slate-100 text-slate-700 py-3 px-4 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  Send Another Email
                </button>

                <button
                  onClick={onBackToLogin}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10">
            <h2 className="text-3xl font-bold text-white text-center">Reset Password</h2>
            <p className="text-blue-100 text-center mt-2">Enter your email to receive reset instructions</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="you@company.com"
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">
                We'll send a password reset link to this email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700 font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-8">
          India Compliant HRMS & Payroll System
        </p>
      </div>
    </div>
  );
}