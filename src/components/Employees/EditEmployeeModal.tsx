import { useState } from 'react';
import { X, Save, User, Briefcase, DollarSign, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';

type Employee = Database['public']['Tables']['employees']['Row'];

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
  departments: any[];
  designations: any[];
  branches: any[];
}

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function EditEmployeeModal({ employee, onClose, onSuccess, departments, designations, branches }: EditEmployeeModalProps) {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'personal' | 'employment' | 'salary' | 'documents'>('personal');
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [formData, setFormData] = useState({
    first_name: employee.first_name,
    middle_name: employee.middle_name || '',
    last_name: employee.last_name,
    date_of_birth: employee.date_of_birth || '',
    gender: employee.gender || 'male',
    marital_status: employee.marital_status || 'single',
    blood_group: employee.blood_group || '',
    personal_email: employee.personal_email || '',
    company_email: employee.company_email || '',
    mobile_number: employee.mobile_number,
    alternate_number: employee.alternate_number || '',
    current_address: employee.current_address || '',
    permanent_address: employee.permanent_address || '',
    city: employee.city || '',
    state: employee.state || '',
    pincode: employee.pincode || '',
    department_id: employee.department_id || '',
    designation_id: employee.designation_id || '',
    branch_id: employee.branch_id || '',
    employment_type: employee.employment_type,
    employment_status: employee.employment_status,
    date_of_joining: employee.date_of_joining,
    probation_end_date: employee.probation_end_date || '',
    pan_number: employee.pan_number || '',
    aadhaar_number: employee.aadhaar_number || '',
    uan_number: employee.uan_number || '',
    esi_number: employee.esi_number || '',
    bank_name: employee.bank_name || '',
    bank_account_number: employee.bank_account_number || '',
    bank_ifsc_code: employee.bank_ifsc_code || '',
    bank_branch: employee.bank_branch || '',
    ctc_annual: employee.ctc_annual?.toString() || '',
    basic_salary: employee.basic_salary?.toString() || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    setLoading(true);

    try {
      const updateData: Database['public']['Tables']['employees']['Update'] = {
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender as any || null,
        marital_status: formData.marital_status as any || null,
        blood_group: formData.blood_group || null,
        personal_email: formData.personal_email || null,
        company_email: formData.company_email || null,
        mobile_number: formData.mobile_number,
        alternate_number: formData.alternate_number || null,
        current_address: formData.current_address || null,
        permanent_address: formData.permanent_address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        department_id: formData.department_id || null,
        designation_id: formData.designation_id || null,
        branch_id: formData.branch_id || null,
        employment_type: formData.employment_type as any,
        employment_status: formData.employment_status as any,
        date_of_joining: formData.date_of_joining,
        probation_end_date: formData.probation_end_date || null,
        pan_number: formData.pan_number || null,
        aadhaar_number: formData.aadhaar_number || null,
        uan_number: formData.uan_number || null,
        esi_number: formData.esi_number || null,
        bank_name: formData.bank_name || null,
        bank_account_number: formData.bank_account_number || null,
        bank_ifsc_code: formData.bank_ifsc_code || null,
        bank_branch: formData.bank_branch || null,
        ctc_annual: formData.ctc_annual ? parseFloat(formData.ctc_annual) : null,
        basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null
      };

      const { error } = await (supabase
        .from('employees')
        .update(updateData as any) as any)
        .eq('id', employee.id);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Success',
        message: 'Employee updated successfully!'
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error updating employee:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to update employee. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'salary', label: 'Salary', icon: DollarSign },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <User className="h-6 w-6 text-blue-600" />
            Edit Employee
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  currentTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentTab === 'personal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Marital Status</label>
                <select
                  name="marital_status"
                  value={formData.marital_status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Blood Group</label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Personal Email</label>
                <input
                  type="email"
                  name="personal_email"
                  value={formData.personal_email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Email *</label>
                <input
                  type="email"
                  name="company_email"
                  value={formData.company_email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mobile Number *</label>
                <input
                  type="tel"
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Alternate Number</label>
                <input
                  type="tel"
                  name="alternate_number"
                  value={formData.alternate_number}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Address</label>
                <textarea
                  name="current_address"
                  value={formData.current_address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Permanent Address</label>
                <textarea
                  name="permanent_address"
                  value={formData.permanent_address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          {currentTab === 'employment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                <select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                <select
                  name="designation_id"
                  value={formData.designation_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">Select Designation</option>
                  {designations.map((desig) => (
                    <option key={desig.id} value={desig.title}>{desig.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Branch</label>
                <select
                  name="branch_id"
                  value={formData.branch_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.name}>{branch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Employment Type</label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Employment Status</label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date of Joining *</label>
                <input
                  type="date"
                  name="date_of_joining"
                  value={formData.date_of_joining}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Probation End Date</label>
                <input
                  type="date"
                  name="probation_end_date"
                  value={formData.probation_end_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          {currentTab === 'salary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Annual CTC (₹)</label>
                <input
                  type="number"
                  name="ctc_annual"
                  value={formData.ctc_annual}
                  onChange={handleChange}
                  placeholder="500000"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Basic Salary (₹)</label>
                <input
                  type="number"
                  name="basic_salary"
                  value={formData.basic_salary}
                  onChange={handleChange}
                  placeholder="30000"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          {currentTab === 'documents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">PAN Number</label>
                <input
                  type="text"
                  name="pan_number"
                  value={formData.pan_number}
                  onChange={handleChange}
                  placeholder="ABCDE1234F"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Aadhaar Number</label>
                <input
                  type="text"
                  name="aadhaar_number"
                  value={formData.aadhaar_number}
                  onChange={handleChange}
                  placeholder="1234 5678 9012"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">UAN Number</label>
                <input
                  type="text"
                  name="uan_number"
                  value={formData.uan_number}
                  onChange={handleChange}
                  placeholder="123456789012"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ESI Number</label>
                <input
                  type="text"
                  name="esi_number"
                  value={formData.esi_number}
                  onChange={handleChange}
                  placeholder="12345678901"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={formData.bank_account_number}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">IFSC Code</label>
                <input
                  type="text"
                  name="bank_ifsc_code"
                  value={formData.bank_ifsc_code}
                  onChange={handleChange}
                  placeholder="SBIN0001234"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bank Branch</label>
                <input
                  type="text"
                  name="bank_branch"
                  value={formData.bank_branch}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-4 p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            Update Employee
          </button>
        </div>

        {alertModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                {alertModal.type === 'success' && <CheckCircle className="h-8 w-8 text-green-600" />}
                {alertModal.type === 'error' && <AlertCircle className="h-8 w-8 text-red-600" />}
                {alertModal.type === 'info' && <AlertCircle className="h-8 w-8 text-blue-600" />}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{alertModal.title}</h3>
                  <p className="text-slate-600 mt-1">{alertModal.message}</p>
                </div>
              </div>
              <button
                onClick={() => setAlertModal(null)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}