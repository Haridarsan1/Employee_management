import { Award, Plus } from 'lucide-react';

export function PerformancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Award className="h-8 w-8 text-yellow-600" />
            Performance Management
          </h1>
          <p className="text-slate-600 mt-2">Goals, Reviews & Feedback</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-xl shadow-lg">
          <Plus className="h-5 w-5" />
          Set Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">Active Goals</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">Completed</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">Reviews</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <Award className="h-16 w-16 text-yellow-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Performance Management</h3>
        <p className="text-slate-600">Set goals (OKRs/KPIs), conduct reviews, and provide 360° feedback</p>
        <p className="text-sm text-slate-500 mt-4">Feature fully implemented in database - UI coming soon</p>
      </div>
    </div>
  );
}
