/*
  # Employee & Payroll Management System - Complete Database Schema

  ## Overview
  This migration creates a comprehensive HRMS and payroll system compliant with Indian statutory requirements.
  
  ## 1. New Tables

  ### Authentication & Users
    - `user_profiles` - Extended user information linked to auth.users
  
  ### Core Employee Management
    - `departments` - Organizational departments
    - `designations` - Job titles/positions
    - `branches` - Office locations/branches
    - `employees` - Central employee database with auto-generated employee IDs
  
  ### Attendance Management
    - `shifts` - Work shift definitions
    - `attendance_records` - Daily attendance tracking with geo-location support
    - `attendance_corrections` - Manual attendance adjustments
  
  ### Leave Management
    - `leave_types` - Leave categories
    - `leave_policies` - Yearly entitlements
    - `leave_applications` - Leave requests
    - `leave_balances` - Current leave balance tracking
    - `holidays` - Holiday calendar
  
  ### Payroll Management
    - `salary_components` - Earnings and deduction definitions
    - `salary_structures` - Employee-specific salary breakdown
    - `payroll_cycles` - Monthly payroll processing records
    - `payslips` - Individual employee payslips
    - `salary_revisions` - Salary increment history
    - `advances_loans` - Employee advances and loans
    - `reimbursements` - Expense claims
  
  ### Statutory Compliance
    - `pf_records` - Provident Fund calculations
    - `esi_records` - ESI contribution records
    - `tds_records` - Tax deduction records
    - `professional_tax` - PT deduction by state
  
  ### System & Audit
    - `audit_logs` - System activity tracking
    - `announcements` - Company-wide notifications
    - `documents` - Employee document storage metadata

  ## 2. Security
    - RLS enabled on all tables
    - Role-based policies (admin, hr, finance, employee)
    - Employees can only view their own data
  
  ## 3. Key Features
    - Automatic employee ID generation
    - Cascading relationships
    - Audit trail
    - Optimized indexes
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'hr', 'finance', 'manager', 'employee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE employment_status AS ENUM ('active', 'probation', 'resigned', 'terminated', 'on_hold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE gender AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave', 'holiday', 'week_off');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payroll_status AS ENUM ('draft', 'processed', 'approved', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE salary_component_type AS ENUM ('earning', 'deduction');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reimbursement_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('offer_letter', 'id_proof', 'address_proof', 'educational', 'experience', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ORGANIZATIONAL STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  head_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS designations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  level integer,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- EMPLOYEE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code text UNIQUE,
  
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  date_of_birth date,
  gender gender,
  marital_status marital_status,
  blood_group text,
  
  personal_email text,
  company_email text UNIQUE,
  mobile_number text NOT NULL,
  alternate_number text,
  current_address text,
  permanent_address text,
  city text,
  state text,
  pincode text,
  
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES designations(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  reporting_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employment_type employment_type NOT NULL DEFAULT 'full_time',
  employment_status employment_status NOT NULL DEFAULT 'probation',
  
  date_of_joining date NOT NULL,
  probation_end_date date,
  confirmation_date date,
  resignation_date date,
  last_working_date date,
  
  pan_number text,
  aadhaar_number text,
  uan_number text,
  esi_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  bank_branch text,
  
  ctc_annual numeric(12,2),
  basic_salary numeric(12,2),
  
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employee code sequence
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;

-- Function to generate employee code
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := 'FM-EMP-' || LPAD(nextval('employee_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employee_code ON employees;
CREATE TRIGGER set_employee_code
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_code();

-- Add foreign key to departments for head_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'departments_head_id_fkey'
  ) THEN
    ALTER TABLE departments
    ADD CONSTRAINT departments_head_id_fkey
    FOREIGN KEY (head_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- USER PROFILES & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'employee',
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SHIFT & ATTENDANCE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_period_minutes integer DEFAULT 15,
  half_day_hours numeric(4,2) DEFAULT 4,
  full_day_hours numeric(4,2) DEFAULT 8,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  attendance_date date NOT NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_latitude numeric(10,8),
  check_in_longitude numeric(11,8),
  check_out_latitude numeric(10,8),
  check_out_longitude numeric(11,8),
  
  status attendance_status NOT NULL DEFAULT 'present',
  is_late boolean DEFAULT false,
  late_by_minutes integer DEFAULT 0,
  early_leave boolean DEFAULT false,
  early_leave_minutes integer DEFAULT 0,
  overtime_minutes integer DEFAULT 0,
  worked_hours numeric(4,2) DEFAULT 0,
  
  remarks text,
  is_manual_entry boolean DEFAULT false,
  marked_by uuid,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(employee_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_record_id uuid REFERENCES attendance_records(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  old_check_in timestamptz,
  new_check_in timestamptz,
  old_check_out timestamptz,
  new_check_out timestamptz,
  
  reason text NOT NULL,
  status leave_status DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- LEAVE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  is_paid boolean DEFAULT true,
  requires_document boolean DEFAULT false,
  max_consecutive_days integer,
  is_carry_forward boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
  employment_type employment_type NOT NULL,
  yearly_quota numeric(5,2) NOT NULL,
  applicable_after_months integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(leave_type_id, employment_type)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  
  total_quota numeric(5,2) NOT NULL,
  used_leaves numeric(5,2) DEFAULT 0,
  pending_leaves numeric(5,2) DEFAULT 0,
  available_leaves numeric(5,2) GENERATED ALWAYS AS (total_quota - used_leaves - pending_leaves) STORED,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
  
  from_date date NOT NULL,
  to_date date NOT NULL,
  is_half_day boolean DEFAULT false,
  half_day_period text,
  total_days numeric(5,2) NOT NULL,
  
  reason text NOT NULL,
  document_url text,
  
  status leave_status DEFAULT 'pending',
  applied_at timestamptz DEFAULT now(),
  
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  holiday_date date NOT NULL,
  description text,
  is_optional boolean DEFAULT false,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PAYROLL MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS salary_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  type salary_component_type NOT NULL,
  description text,
  is_fixed boolean DEFAULT true,
  is_taxable boolean DEFAULT true,
  calculation_formula text,
  display_order integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  component_id uuid REFERENCES salary_components(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL,
  percentage numeric(5,2),
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_cycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  month integer NOT NULL,
  year integer NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  
  total_employees integer DEFAULT 0,
  total_gross_salary numeric(15,2) DEFAULT 0,
  total_deductions numeric(15,2) DEFAULT 0,
  total_net_salary numeric(15,2) DEFAULT 0,
  
  status payroll_status DEFAULT 'draft',
  processed_by uuid,
  processed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_cycle_id uuid REFERENCES payroll_cycles(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  working_days integer NOT NULL,
  present_days numeric(5,2) NOT NULL,
  leave_days numeric(5,2) DEFAULT 0,
  lop_days numeric(5,2) DEFAULT 0,
  paid_days numeric(5,2) NOT NULL,
  
  gross_salary numeric(12,2) NOT NULL,
  total_earnings numeric(12,2) NOT NULL,
  total_deductions numeric(12,2) NOT NULL,
  net_salary numeric(12,2) NOT NULL,
  
  earnings jsonb NOT NULL DEFAULT '{}',
  deductions jsonb NOT NULL DEFAULT '{}',
  
  remarks text,
  is_emailed boolean DEFAULT false,
  emailed_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(payroll_cycle_id, employee_id)
);

CREATE TABLE IF NOT EXISTS salary_revisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  old_ctc numeric(12,2) NOT NULL,
  new_ctc numeric(12,2) NOT NULL,
  increment_amount numeric(12,2) NOT NULL,
  increment_percentage numeric(5,2) NOT NULL,
  
  effective_from date NOT NULL,
  reason text,
  remarks text,
  
  approved_by uuid,
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advances_loans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  
  installments integer DEFAULT 1,
  installment_amount numeric(12,2),
  paid_installments integer DEFAULT 0,
  remaining_amount numeric(12,2),
  
  status leave_status DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reimbursements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  expense_date date NOT NULL,
  description text NOT NULL,
  bill_url text,
  
  status reimbursement_status DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STATUTORY COMPLIANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pf_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id uuid REFERENCES payslips(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  month integer NOT NULL,
  year integer NOT NULL,
  
  basic_wages numeric(12,2) NOT NULL,
  employee_contribution numeric(12,2) NOT NULL,
  employer_contribution numeric(12,2) NOT NULL,
  eps_contribution numeric(12,2) NOT NULL,
  total_contribution numeric(12,2) NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS esi_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id uuid REFERENCES payslips(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  month integer NOT NULL,
  year integer NOT NULL,
  
  gross_wages numeric(12,2) NOT NULL,
  employee_contribution numeric(12,2) NOT NULL,
  employer_contribution numeric(12,2) NOT NULL,
  total_contribution numeric(12,2) NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tds_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  financial_year text NOT NULL,
  
  total_gross_salary numeric(12,2) NOT NULL,
  standard_deduction numeric(12,2) DEFAULT 0,
  hra_exemption numeric(12,2) DEFAULT 0,
  section_80c numeric(12,2) DEFAULT 0,
  other_deductions numeric(12,2) DEFAULT 0,
  taxable_income numeric(12,2) NOT NULL,
  total_tax numeric(12,2) NOT NULL,
  
  tax_deducted jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(employee_id, financial_year)
);

CREATE TABLE IF NOT EXISTS professional_tax (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  state text NOT NULL,
  salary_from numeric(12,2) NOT NULL,
  salary_to numeric(12,2),
  tax_amount numeric(12,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SYSTEM & AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'general',
  priority text DEFAULT 'normal',
  is_active boolean DEFAULT true,
  published_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  document_type document_type NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);

CREATE INDEX IF NOT EXISTS idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_applications_dates ON leave_applications(from_date, to_date);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_cycle ON payslips(payroll_cycle_id);

CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE esi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tds_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_tax ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Admins can manage profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Departments Policies
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR and Admin can manage departments"
  ON departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Designations Policies
CREATE POLICY "Authenticated users can view designations"
  ON designations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR and Admin can manage designations"
  ON designations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Branches Policies
CREATE POLICY "Authenticated users can view branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Employees Policies
CREATE POLICY "Employees can view own record"
  ON employees FOR SELECT
  TO authenticated
  USING (
    id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "HR and Admin can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance', 'manager')
    )
  );

CREATE POLICY "HR and Admin can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Attendance Records Policies
CREATE POLICY "Employees can view own attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "HR and Admin can view all attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

CREATE POLICY "Employees can mark own attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "HR and Admin can manage attendance"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Leave Applications Policies
CREATE POLICY "Employees can view own leaves"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can view team leaves"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN user_profiles up ON up.employee_id = e.id
      WHERE up.user_id = auth.uid()
      AND e.id = leave_applications.employee_id
      AND (e.reporting_manager_id = up.employee_id OR up.role IN ('admin', 'hr'))
    )
  );

CREATE POLICY "Employees can apply for leave"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can approve leaves"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN user_profiles up ON up.employee_id = e.id
      WHERE up.user_id = auth.uid()
      AND e.id = leave_applications.employee_id
      AND (e.reporting_manager_id = up.employee_id OR up.role IN ('admin', 'hr'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN user_profiles up ON up.employee_id = e.id
      WHERE up.user_id = auth.uid()
      AND e.id = leave_applications.employee_id
      AND (e.reporting_manager_id = up.employee_id OR up.role IN ('admin', 'hr'))
    )
  );

-- Payslips Policies
CREATE POLICY "Employees can view own payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Finance, HR and Admin can view all payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance')
    )
  );

CREATE POLICY "Finance, HR and Admin can manage payslips"
  ON payslips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance')
    )
  );

-- Reimbursements Policies
CREATE POLICY "Employees can view own reimbursements"
  ON reimbursements FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "HR and Finance can view all reimbursements"
  ON reimbursements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance')
    )
  );

CREATE POLICY "Employees can submit reimbursements"
  ON reimbursements FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Finance can manage reimbursements"
  ON reimbursements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'finance')
    )
  );

-- Announcements Policies
CREATE POLICY "All authenticated users can view active announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "HR and Admin can manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Documents Policies
CREATE POLICY "Employees can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT employee_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "HR and Admin can view all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR and Admin can manage documents"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Generic policies for master data tables
CREATE POLICY "Authenticated users can view leave types"
  ON leave_types FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated users can view shifts"
  ON shifts FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated users can view holidays"
  ON holidays FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Finance can view salary components"
  ON salary_components FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'hr', 'finance')
    )
  );

CREATE POLICY "Admin can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
