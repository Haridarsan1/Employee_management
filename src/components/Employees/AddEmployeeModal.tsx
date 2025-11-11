import { useState } from 'react';
import { X, Save, User, Briefcase, DollarSign, FileText, Mail, Send, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AddEmployeeModalProps {
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
  invitationLink?: string;
  credentials?: {
    email: string;
    password: string;
  };
}

export function AddEmployeeModal({ onClose, onSuccess, departments, designations, branches }: AddEmployeeModalProps) {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'personal' | 'employment' | 'salary' | 'documents'>('personal');
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);

  // Generate a secure temporary password
  const generateTempPassword = () => {
    const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*';
    
    // Ensure password has at least one of each required character type
    let password = '';
    password += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
    password += lowerChars.charAt(Math.floor(Math.random() * lowerChars.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    
    // Fill remaining characters randomly
    const allChars = upperChars + lowerChars + numbers + specialChars;
    for (let i = password.length; i < 12; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'male',
    marital_status: 'single',
    blood_group: '',
    personal_email: '',
    company_email: '',
    mobile_number: '',
    alternate_number: '',
    current_address: '',
    permanent_address: '',
    city: '',
    state: '',
    pincode: '',
    department_id: '',
    designation_id: '',
    branch_id: '',
    employment_type: 'full_time',
    employment_status: 'probation',
    date_of_joining: '',
    probation_end_date: '',
    pan_number: '',
    aadhaar_number: '',
    uan_number: '',
    esi_number: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    bank_branch: '',
    ctc_annual: '',
    basic_salary: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (!formData.company_email) {
      setAlertModal({
        type: 'error',
        title: 'Missing Email',
        message: 'Company email is required to create employee and send invitation.'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .insert({
          ...formData,
          organization_id: organization.id,
          ctc_annual: formData.ctc_annual ? parseFloat(formData.ctc_annual) : null,
          basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null,
          department_id: formData.department_id || null,
          designation_id: formData.designation_id || null,
          branch_id: formData.branch_id || null
        })
        .select()
        .single();

      if (employeeError) throw employeeError;

      // Log audit event
      await supabase
        .from('audit_logs')
        .insert({
          organization_id: organization.id,
          action: 'CREATE',
          table_name: 'employees',
          record_id: employeeData.id,
          new_values: formData
        });

      // Generate temporary password and create auth user
      const tempPassword = generateTempPassword();

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.company_email,
        password: tempPassword,
        options: {
          data: {
            full_name: `${formData.first_name} ${formData.last_name}`
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create organization membership
        const { error: membershipError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: organization.id,
            user_id: authData.user.id,
            role: 'employee',
            employee_id: employeeData.id,
            is_active: true
          });

        if (membershipError) throw membershipError;

        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: authData.user.id,
            current_organization_id: organization.id,
            is_active: true
          });

        if (profileError) throw profileError;

        // Log auth user creation
        await supabase
          .from('audit_logs')
          .insert({
            organization_id: organization.id,
            action: 'CREATE',
            table_name: 'auth.users',
            record_id: authData.user.id,
            new_values: { email: formData.company_email, role: 'employee' }
          });

        setAlertModal({
          type: 'success',
          title: 'Employee Added Successfully!',
          message: `Employee ${formData.first_name} ${formData.last_name} has been created with login credentials.`,
          credentials: {
            email: formData.company_email,
            password: tempPassword
          }
        });
      } else {
        setAlertModal({
          type: 'success',
          title: 'Employee Added Successfully!',
          message: `Employee ${formData.first_name} ${formData.last_name} has been added to the system.`
        });
      }
    } catch (error: any) {
      console.error('Error adding employee:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to add employee: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (alertModal?.credentials) {
      const credentialsText = `Email: ${alertModal.credentials.email}\nPassword: ${alertModal.credentials.password}`;
      navigator.clipboard.writeText(credentialsText);
      setAlertModal({
        ...alertModal,
        message: 'Login credentials copied to clipboard!'
      });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'salary', label: 'Salary', icon: DollarSign },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  return (
    <>
      {alertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
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
                  onClick={() => {
                    setAlertModal(null);
                    if (alertModal.type === 'success' && !alertModal.invitationLink && !alertModal.credentials) {
                      onSuccess();
                      onClose();
                    }
                  }}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-base mb-4">{alertModal.message}</p>
              {alertModal.credentials && (
                <div className="bg-slate-100 rounded-lg p-4 mb-4">
                  <p className="text-xs text-slate-600 mb-2 font-semibold">Login Credentials:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-900 font-mono">{alertModal.credentials.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-900 font-mono">{alertModal.credentials.password}</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Please securely share these credentials with the employee and advise them to change their password after first login.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                {alertModal.credentials ? (
                  <button
                    onClick={copyCredentials}
                    className="flex-1 py-3 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Copy Credentials & Close
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAlertModal(null);
                      if (alertModal.type === 'success') {
                        onSuccess();
                        onClose();
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl font-semibold text-white transition-all ${
                      alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' :
                      alertModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                      'bg-blue-500 hover:bg-blue-600'
                    }`}>
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Add New Employee</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  currentTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {currentTab === 'personal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Marital Status
                  </label>
                  <select
                    name="marital_status"
                    value={formData.marital_status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    name="mobile_number"
                    required
                    value={formData.mobile_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Alternate Number
                  </label>
                  <input
                    type="tel"
                    name="alternate_number"
                    value={formData.alternate_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Personal Email
                  </label>
                  <input
                    type="email"
                    name="personal_email"
                    value={formData.personal_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Email
                  </label>
                  <input
                    type="email"
                    name="company_email"
                    value={formData.company_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Address
                </label>
                <textarea
                  name="current_address"
                  value={formData.current_address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Permanent Address
                </label>
                <textarea
                  name="permanent_address"
                  value={formData.permanent_address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'employment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Designation
                  </label>
                  <select
                    name="designation_id"
                    value={formData.designation_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Designation</option>
                    {designations.map(desig => (
                      <option key={desig.id} value={desig.id}>{desig.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Branch
                  </label>
                  <select
                    name="branch_id"
                    value={formData.branch_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employment Type *
                  </label>
                  <select
                    name="employment_type"
                    required
                    value={formData.employment_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employment Status *
                  </label>
                  <select
                    name="employment_status"
                    required
                    value={formData.employment_status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="probation">Probation</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date of Joining *
                  </label>
                  <input
                    type="date"
                    name="date_of_joining"
                    required
                    value={formData.date_of_joining}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Probation End Date
                </label>
                <input
                  type="date"
                  name="probation_end_date"
                  value={formData.probation_end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    name="aadhaar_number"
                    value={formData.aadhaar_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234 5678 9012"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    UAN Number
                  </label>
                  <input
                    type="text"
                    name="uan_number"
                    value={formData.uan_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ESI Number
                  </label>
                  <input
                    type="text"
                    name="esi_number"
                    value={formData.esi_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    name="bank_ifsc_code"
                    value={formData.bank_ifsc_code}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Bank Branch
                  </label>
                  <input
                    type="text"
                    name="bank_branch"
                    value={formData.bank_branch}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'salary' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Define the employee's annual CTC and basic salary. You can set up detailed salary components later.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Annual CTC (₹)
                  </label>
                  <input
                    type="number"
                    name="ctc_annual"
                    value={formData.ctc_annual}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Basic Salary (Monthly) (₹)
                  </label>
                  <input
                    type="number"
                    name="basic_salary"
                    value={formData.basic_salary}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="25000"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-2">Salary Breakdown (Optional)</h3>
                <p className="text-sm text-slate-600 mb-4">
                  You can configure detailed salary components (HRA, allowances, deductions) from the employee's profile after creation.
                </p>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Basic Salary:</span>
                    <span className="font-medium">₹{formData.basic_salary || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HRA (40%):</span>
                    <span className="font-medium">₹{formData.basic_salary ? (parseFloat(formData.basic_salary) * 0.4).toFixed(2) : '0'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-medium">Gross Monthly:</span>
                    <span className="font-medium">₹{formData.basic_salary ? (parseFloat(formData.basic_salary) * 1.4).toFixed(2) : '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'documents' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Document upload will be available after creating the employee profile.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Required Documents</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Offer Letter
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Aadhaar Card
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PAN Card
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Educational Certificates
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Experience Letters
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-3">
            {currentTab !== 'personal' && (
              <button
                type="button"
                onClick={() => {
                  const tabs = ['personal', 'employment', 'salary', 'documents'];
                  const currentIndex = tabs.indexOf(currentTab);
                  setCurrentTab(tabs[currentIndex - 1] as any);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors"
              >
                Previous
              </button>
            )}
            {currentTab !== 'documents' ? (
              <button
                type="button"
                onClick={() => {
                  const tabs = ['personal', 'employment', 'salary', 'documents'];
                  const currentIndex = tabs.indexOf(currentTab);
                  setCurrentTab(tabs[currentIndex + 1] as any);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : 'Create Employee'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
