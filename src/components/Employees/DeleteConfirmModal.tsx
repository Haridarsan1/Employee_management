import { AlertTriangle, X } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Employee = Database['public']['Tables']['employees']['Row'];

interface DeleteConfirmModalProps {
  employee: Employee;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ employee, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Delete Employee</h3>
            <p className="text-slate-600 text-sm mt-1">This action cannot be undone</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors ml-auto"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-slate-700 mb-3">
            Are you sure you want to delete the employee <strong>{employee.first_name} {employee.last_name}</strong>?
          </p>
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <p><strong>Employee Code:</strong> {employee.employee_code || 'N/A'}</p>
            <p><strong>Email:</strong> {employee.company_email || 'N/A'}</p>
          </div>
          <p className="text-red-600 text-sm mt-3">
            This will permanently delete all associated data including attendance records, leave requests, and payroll information.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
          >
            Delete Employee
          </button>
        </div>
      </div>
    </div>
  );
}