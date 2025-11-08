/*
  # SaaS Multi-Tenancy Support v2

  ## Overview
  This migration adds multi-tenancy support for SaaS model with organization management,
  subscription plans, and proper tenant isolation.

  ## Changes
  - Add organizations and subscription tables
  - Add organization_id to all existing tables
  - Update RLS policies for tenant isolation
  - Drop and recreate policies that depend on old structure
*/

-- ============================================================================
-- CREATE ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_interval AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ORGANIZATIONS & MULTI-TENANCY
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subdomain text UNIQUE,
  logo_url text,
  
  email text,
  phone text,
  website text,
  
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  pincode text,
  
  gstin text,
  pan_number text,
  tan_number text,
  
  settings jsonb DEFAULT '{}',
  trial_ends_at timestamptz,
  
  owner_id uuid NOT NULL,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  employee_id uuid,
  
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  
  price_monthly numeric(10,2) NOT NULL,
  price_yearly numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  
  max_employees integer,
  max_users integer,
  
  features jsonb DEFAULT '{}',
  
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL,
  
  status subscription_status DEFAULT 'trial',
  interval plan_interval DEFAULT 'monthly',
  
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  trial_start timestamptz,
  trial_end timestamptz,
  cancelled_at timestamptz,
  
  payment_method text,
  last_payment_date timestamptz,
  next_payment_date timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  
  status invitation_status DEFAULT 'pending',
  invited_by uuid NOT NULL,
  token text UNIQUE NOT NULL,
  
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ADD ORGANIZATION_ID TO EXISTING TABLES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE departments ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_departments_organization ON departments(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'designations' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE designations ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_designations_organization ON designations(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_branches_organization ON branches(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_employees_organization ON employees(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_shifts_organization ON shifts(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_types' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_leave_types_organization ON leave_types(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_components' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE salary_components ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_salary_components_organization ON salary_components(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE announcements ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_announcements_organization ON announcements(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_organization_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for employee_id in organization_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_members_employee_id_fkey'
  ) THEN
    ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS uuid AS $$
  SELECT current_organization_id FROM user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_organization_owner(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role_in_organization(org_id uuid)
RETURNS user_role AS $$
  SELECT role FROM organization_members
  WHERE organization_id = org_id AND user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_employee_id_in_organization(org_id uuid)
RETURNS uuid AS $$
  SELECT employee_id FROM organization_members
  WHERE organization_id = org_id AND user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- DROP OLD POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Employees can view own record" ON employees;
DROP POLICY IF EXISTS "Employees can view own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can mark own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can view own leaves" ON leave_applications;
DROP POLICY IF EXISTS "Managers can view team leaves" ON leave_applications;
DROP POLICY IF EXISTS "Employees can apply for leave" ON leave_applications;
DROP POLICY IF EXISTS "Managers can approve leaves" ON leave_applications;
DROP POLICY IF EXISTS "Employees can view own payslips" ON payslips;
DROP POLICY IF EXISTS "Employees can view own reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Employees can submit reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Employees can view own documents" ON documents;

DROP POLICY IF EXISTS "Authenticated users can view departments" ON departments;
DROP POLICY IF EXISTS "HR and Admin can manage departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can view designations" ON designations;
DROP POLICY IF EXISTS "HR and Admin can manage designations" ON designations;
DROP POLICY IF EXISTS "Authenticated users can view branches" ON branches;
DROP POLICY IF EXISTS "Admin can manage branches" ON branches;
DROP POLICY IF EXISTS "HR and Admin can view all employees" ON employees;
DROP POLICY IF EXISTS "HR and Admin can manage employees" ON employees;
DROP POLICY IF EXISTS "HR and Admin can view all attendance" ON attendance_records;
DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON attendance_records;
DROP POLICY IF EXISTS "All authenticated users can view active announcements" ON announcements;
DROP POLICY IF EXISTS "HR and Admin can manage announcements" ON announcements;
DROP POLICY IF EXISTS "HR and Admin can view all documents" ON documents;
DROP POLICY IF EXISTS "HR and Admin can manage documents" ON documents;

DROP POLICY IF EXISTS "Authenticated users can view leave types" ON leave_types;
DROP POLICY IF EXISTS "Authenticated users can view shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can view holidays" ON holidays;
DROP POLICY IF EXISTS "Finance can view salary components" ON salary_components;

DROP POLICY IF EXISTS "Finance, HR and Admin can view all payslips" ON payslips;
DROP POLICY IF EXISTS "Finance, HR and Admin can manage payslips" ON payslips;
DROP POLICY IF EXISTS "HR and Finance can view all reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Finance can manage reimbursements" ON reimbursements;

-- ============================================================================
-- NEW RLS POLICIES - ORGANIZATIONS
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Organization owners can update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id) OR user_id = auth.uid());

CREATE POLICY "Organization owners can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_organization_owner(organization_id))
  WITH CHECK (is_organization_owner(organization_id));

CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can view their organization subscriptions"
  ON organization_subscriptions FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

CREATE POLICY "Organization owners can manage subscriptions"
  ON organization_subscriptions FOR ALL
  TO authenticated
  USING (is_organization_owner(organization_id))
  WITH CHECK (is_organization_owner(organization_id));

CREATE POLICY "Users can view invitations"
  ON organization_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    is_organization_member(organization_id)
  );

CREATE POLICY "Organization members can create invitations"
  ON organization_invitations FOR INSERT
  TO authenticated
  WITH CHECK (is_organization_member(organization_id));

-- ============================================================================
-- NEW RLS POLICIES - TENANT ISOLATION
-- ============================================================================

-- Departments
CREATE POLICY "Users can view organization departments"
  ON departments FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

CREATE POLICY "HR and Admin can manage organization departments"
  ON departments FOR ALL
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  )
  WITH CHECK (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  );

-- Designations
CREATE POLICY "Users can view organization designations"
  ON designations FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

CREATE POLICY "HR and Admin can manage organization designations"
  ON designations FOR ALL
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  )
  WITH CHECK (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  );

-- Branches
CREATE POLICY "Users can view organization branches"
  ON branches FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

CREATE POLICY "Admin can manage organization branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) = 'admin'
  )
  WITH CHECK (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) = 'admin'
  );

-- Employees
CREATE POLICY "Users can view organization employees"
  ON employees FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

CREATE POLICY "HR and Admin can manage organization employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  )
  WITH CHECK (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  );

-- Attendance Records
CREATE POLICY "Users can view organization attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_records.employee_id
      AND is_organization_member(employees.organization_id)
    )
  );

CREATE POLICY "Employees can mark own attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = get_user_employee_id_in_organization(
      (SELECT organization_id FROM employees WHERE id = employee_id)
    )
  );

CREATE POLICY "HR and Admin can manage organization attendance"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_records.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_records.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr')
    )
  );

-- Leave Applications
CREATE POLICY "Users can view organization leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_applications.employee_id
      AND is_organization_member(employees.organization_id)
    )
  );

CREATE POLICY "Employees can apply for leave"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = get_user_employee_id_in_organization(
      (SELECT organization_id FROM employees WHERE id = employee_id)
    )
  );

CREATE POLICY "Managers can approve leaves"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_applications.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_applications.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr', 'manager')
    )
  );

-- Payslips
CREATE POLICY "Users can view organization payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = payslips.employee_id
      AND is_organization_member(employees.organization_id)
    )
  );

CREATE POLICY "Finance HR Admin can manage payslips"
  ON payslips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = payslips.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = payslips.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr', 'finance')
    )
  );

-- Reimbursements
CREATE POLICY "Users can view organization reimbursements"
  ON reimbursements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = reimbursements.employee_id
      AND is_organization_member(employees.organization_id)
    )
  );

CREATE POLICY "Employees can submit reimbursements"
  ON reimbursements FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = get_user_employee_id_in_organization(
      (SELECT organization_id FROM employees WHERE id = employee_id)
    )
  );

CREATE POLICY "Finance can manage reimbursements"
  ON reimbursements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = reimbursements.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = reimbursements.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'finance')
    )
  );

-- Documents
CREATE POLICY "Users can view organization documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = documents.employee_id
      AND is_organization_member(employees.organization_id)
    )
  );

CREATE POLICY "HR and Admin can manage documents"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = documents.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = documents.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('admin', 'hr')
    )
  );

-- Announcements
CREATE POLICY "Users can view organization announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id) AND is_active = true);

CREATE POLICY "HR and Admin can manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  )
  WITH CHECK (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr')
  );

-- Master data tables
CREATE POLICY "Users can view organization leave types"
  ON leave_types FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id) AND is_active = true);

CREATE POLICY "Users can view organization shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id) AND is_active = true);

CREATE POLICY "Users can view holidays"
  ON holidays FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Finance can view organization salary components"
  ON salary_components FOR SELECT
  TO authenticated
  USING (
    is_organization_member(organization_id) AND
    get_user_role_in_organization(organization_id) IN ('admin', 'hr', 'finance')
  );

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_employees, max_users, features, display_order)
VALUES
  (
    'Starter',
    'Perfect for small businesses',
    999,
    9990,
    25,
    5,
    '{"attendance": true, "leave": true, "payroll": true, "reports": "basic"}'::jsonb,
    1
  ),
  (
    'Professional',
    'For growing companies',
    2499,
    24990,
    100,
    15,
    '{"attendance": true, "leave": true, "payroll": true, "reports": "advanced", "biometric": true}'::jsonb,
    2
  ),
  (
    'Enterprise',
    'For large organizations',
    4999,
    49990,
    null,
    null,
    '{"attendance": true, "leave": true, "payroll": true, "reports": "advanced", "biometric": true, "api": true, "support": "priority"}'::jsonb,
    3
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
