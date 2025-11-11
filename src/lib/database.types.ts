// Database type definitions for the EMS application

export type UserRole = 'admin' | 'owner' | 'hr' | 'finance' | 'manager' | 'employee';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

export type EmploymentStatus = 'active' | 'probation' | 'notice_period' | 'resigned' | 'terminated';

export type Gender = 'male' | 'female' | 'other';

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export type LeaveType = 'sick' | 'casual' | 'earned' | 'maternity' | 'paternity' | 'unpaid';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'work_from_home' | 'on_leave';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export type SubscriptionStatus = 'active' | 'trial' | 'cancelled' | 'expired';

// Database table interfaces
export interface Organization {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logo_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  current_organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: Gender;
  marital_status: MaritalStatus | null;
  blood_group: string | null;
  personal_email: string | null;
  company_email: string;
  mobile_number: string;
  alternate_number: string | null;
  current_address: string | null;
  permanent_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  department_id: string | null;
  designation_id: string | null;
  branch_id: string | null;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  date_of_joining: string;
  probation_end_date: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
  uan_number: string | null;
  esi_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_branch: string | null;
  ctc_annual: number | null;
  basic_salary: number | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Designation {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  work_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  employee_id: string;
  category_id: string | null;
  amount: number;
  date: string;
  description: string;
  receipt_url: string | null;
  status: ExpenseStatus;
  approved_by: string | null;
  approved_at: string | null;
  reimbursed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payroll {
  id: string;
  organization_id: string;
  employee_id: string;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  status: 'draft' | 'processed' | 'paid';
  processed_by: string | null;
  processed_at: string | null;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: any | null;
  new_values: any | null;
  created_at: string;
}
