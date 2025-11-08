import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Lock, AlertCircle, Info } from 'lucide-react';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError('Invalid email or password');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10">
            <h2 className="text-3xl font-bold text-white text-center">Welcome Back</h2>
            <p className="text-blue-100 text-center mt-2">Sign in to your HRMS account</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-blue-50 to-violet-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Testing Employee Access</p>
                  <p className="text-xs text-blue-700 mt-1">How to see employee features</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-700">
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-2">📋 Steps to Test Employee View:</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside text-slate-600">
                    <li>Login as Admin (your existing account)</li>
                    <li>Go to "Employees" module</li>
                    <li>Click "Add Employee"</li>
                    <li>Fill employee details</li>
                    <li>System sends invitation link</li>
                    <li>Use invitation to create employee account</li>
                    <li>Login with new employee credentials</li>
                  </ol>
                </div>

                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <p className="font-semibold text-emerald-900 mb-1">✨ What Employees Will See:</p>
                  <p className="text-xs text-emerald-700">
                    Employees get access to: Dashboard (personal), Profile, Tasks, Attendance,
                    Leave, Expenses, Performance, Training, Helpdesk, and Announcements.
                  </p>
                </div>

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="font-semibold text-amber-900 mb-1">🚫 Hidden from Employees:</p>
                  <p className="text-xs text-amber-700">
                    Employees cannot see: Employee Management, Payroll, Reports, or Settings.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-2 text-sm text-slate-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Don't have an account? Start Free Trial
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
