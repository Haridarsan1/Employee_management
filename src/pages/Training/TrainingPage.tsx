import { BookOpen, Plus } from 'lucide-react';
import { useScope } from '../../contexts/ScopeContext';
import { ScopeBar } from '../../components/Scope/ScopeBar';

export function TrainingPage() {
  const { selectedDepartmentId, selectedEmployeeId } = useScope();
  return (
    <>
      <ScopeBar />
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-green-600" />
            Training & Development
          </h1>
          <p className="text-slate-600 mt-2">Courses, Certifications & Learning Paths</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-lg">
          <Plus className="h-5 w-5" />
          New Course
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-slate-600">Available Courses</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-slate-600">Enrolled</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-slate-600">Completed</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="h-12 w-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">0</span>
          </div>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-slate-600">Certifications</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <BookOpen className="h-16 w-16 text-green-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Training & Development</h3>
        <p className="text-slate-600">Create courses, track enrollments, and manage certifications</p>
        <p className="text-sm text-slate-500 mt-4">Feature fully implemented in database - UI coming soon</p>
      </div>
      </div>
    </>
  );
}
