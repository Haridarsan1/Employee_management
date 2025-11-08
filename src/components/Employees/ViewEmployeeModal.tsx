import { X, User, Briefcase, DollarSign, FileText, Calendar, Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Employee = Database['public']['Tables']['employees']['Row'];

interface ViewEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  departments: any[];
  designations: any[];
  branches: any[];
}

export function ViewEmployeeModal({ employee, onClose, departments, designations, branches }: ViewEmployeeModalProps) {
  const getDepartmentName = (id: string | null) => {
    const dept = departments.find(d => d.id === id);
    return dept?.name || 'N/A';
  };

  const getDesignationName = (id: string | null) => {
    const desig = designations.find(d => d.id === id);
    return desig?.title || 'N/A';
  };

  const getBranchName = (id: string | null) => {
    const branch = branches.find(b => b.id === id);
    return branch?.name || 'N/A';
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {employee.first_name} {employee.middle_name} {employee.last_name}
              </h2>
              <p className="text-slate-600 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {getDesignationName(employee.designation_id)} • {employee.employee_code}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Personal Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Personal Information</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Employee Code</label>
                  <p className="text-slate-900 font-medium">{employee.employee_code || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Date of Birth</label>
                  <p className="text-slate-900">{formatDate(employee.date_of_birth)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Gender</label>
                  <p className="text-slate-900 capitalize">{employee.gender || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Marital Status</label>
                  <p className="text-slate-900 capitalize">{employee.marital_status || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Blood Group</label>
                  <p className="text-slate-900">{employee.blood_group || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Personal Email:</span>
                  <span className="text-slate-900">{employee.personal_email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Company Email:</span>
                  <span className="text-slate-900">{employee.company_email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Mobile:</span>
                  <span className="text-slate-900">{employee.mobile_number}</span>
                </div>
                {employee.alternate_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Alternate:</span>
                    <span className="text-slate-900">{employee.alternate_number}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Current Address</label>
                  <p className="text-slate-900 text-sm">{employee.current_address || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Permanent Address</label>
                  <p className="text-slate-900 text-sm">{employee.permanent_address || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {employee.city && employee.state ? `${employee.city}, ${employee.state}` : 'N/A'}
                    {employee.pincode && ` - ${employee.pincode}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Employment Information</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Department</label>
                  <p className="text-slate-900">{getDepartmentName(employee.department_id)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Designation</label>
                  <p className="text-slate-900">{getDesignationName(employee.designation_id)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Branch</label>
                  <p className="text-slate-900">{getBranchName(employee.branch_id)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Employment Type</label>
                  <p className="text-slate-900 capitalize">{employee.employment_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Employment Status</label>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    employee.employment_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    employee.employment_status === 'probation' ? 'bg-amber-100 text-amber-700' :
                    employee.employment_status === 'resigned' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {employee.employment_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Date of Joining:</span>
                  <span className="text-slate-900">{formatDate(employee.date_of_joining)}</span>
                </div>
                {employee.probation_end_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Probation End:</span>
                    <span className="text-slate-900">{formatDate(employee.probation_end_date)}</span>
                  </div>
                )}
                {employee.confirmation_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Confirmation Date:</span>
                    <span className="text-slate-900">{formatDate(employee.confirmation_date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Salary Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Salary Information</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Annual CTC</label>
                  <p className="text-slate-900 font-semibold text-lg">{formatCurrency(employee.ctc_annual)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Basic Salary</label>
                  <p className="text-slate-900 font-semibold">{formatCurrency(employee.basic_salary)}</p>
                </div>
              </div>
            </div>

            {/* Documents & Bank Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Documents & Banking</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">PAN Number</label>
                    <p className="text-slate-900 font-mono">{employee.pan_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Aadhaar Number</label>
                    <p className="text-slate-900 font-mono">{employee.aadhaar_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">UAN Number</label>
                    <p className="text-slate-900 font-mono">{employee.uan_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">ESI Number</label>
                    <p className="text-slate-900 font-mono">{employee.esi_number || 'N/A'}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Bank Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name</label>
                      <p className="text-slate-900">{employee.bank_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                      <p className="text-slate-900 font-mono">{employee.bank_account_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">IFSC Code</label>
                      <p className="text-slate-900 font-mono">{employee.bank_ifsc_code || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Branch</label>
                      <p className="text-slate-900">{employee.bank_branch || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}