export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'hr' | 'finance' | 'manager' | 'employee' | 'owner';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type EmploymentStatus = 'active' | 'probation' | 'resigned' | 'terminated' | 'on_hold';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'week_off';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PayrollStatus = 'draft' | 'processed' | 'approved' | 'paid';
export type SalaryComponentType = 'earning' | 'deduction';
export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type DocumentType = 'offer_letter' | 'id_proof' | 'address_proof' | 'educational' | 'experience' | 'other';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string | null;
          employee_id: string | null;
          role: UserRole;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          head_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      designations: {
        Row: {
          id: string;
          title: string;
          code: string;
          level: number | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['designations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['designations']['Insert']>;
      };
      branches: {
        Row: {
          id: string;
          name: string;
          code: string;
          address: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          phone: string | null;
          email: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
      };
      employees: {
        Row: {
          id: string;
          employee_code: string | null;
          first_name: string;
          middle_name: string | null;
          last_name: string;
          date_of_birth: string | null;
          gender: Gender | null;
          marital_status: MaritalStatus | null;
          blood_group: string | null;
          personal_email: string | null;
          company_email: string | null;
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
          reporting_manager_id: string | null;
          employment_type: EmploymentType;
          employment_status: EmploymentStatus;
          date_of_joining: string;
          probation_end_date: string | null;
          confirmation_date: string | null;
          resignation_date: string | null;
          last_working_date: string | null;
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
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'employee_code' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      attendance_records: {
        Row: {
          id: string;
          employee_id: string;
          attendance_date: string;
          shift_id: string | null;
          check_in_time: string | null;
          check_out_time: string | null;
          check_in_latitude: number | null;
          check_in_longitude: number | null;
          check_out_latitude: number | null;
          check_out_longitude: number | null;
          status: AttendanceStatus;
          is_late: boolean;
          late_by_minutes: number;
          early_leave: boolean;
          early_leave_minutes: number;
          overtime_minutes: number;
          worked_hours: number;
          remarks: string | null;
          is_manual_entry: boolean;
          marked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attendance_records']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['attendance_records']['Insert']>;
      };
      leave_applications: {
        Row: {
          id: string;
          employee_id: string;
          leave_type_id: string;
          from_date: string;
          to_date: string;
          is_half_day: boolean;
          half_day_period: string | null;
          total_days: number;
          reason: string;
          document_url: string | null;
          status: LeaveStatus;
          applied_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['leave_applications']['Row'], 'id' | 'applied_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['leave_applications']['Insert']>;
      };
      payslips: {
        Row: {
          id: string;
          payroll_cycle_id: string;
          employee_id: string;
          working_days: number;
          present_days: number;
          leave_days: number;
          lop_days: number;
          paid_days: number;
          gross_salary: number;
          total_earnings: number;
          total_deductions: number;
          net_salary: number;
          earnings: Json;
          deductions: Json;
          remarks: string | null;
          is_emailed: boolean;
          emailed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payslips']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payslips']['Insert']>;
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          type: string;
          priority: string;
          is_active: boolean;
          published_at: string;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'published_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      user_role: UserRole;
      employment_type: EmploymentType;
      employment_status: EmploymentStatus;
      gender: Gender;
      marital_status: MaritalStatus;
      attendance_status: AttendanceStatus;
      leave_status: LeaveStatus;
      payroll_status: PayrollStatus;
      salary_component_type: SalaryComponentType;
      reimbursement_status: ReimbursementStatus;
      document_type: DocumentType;
    };
  };
}
