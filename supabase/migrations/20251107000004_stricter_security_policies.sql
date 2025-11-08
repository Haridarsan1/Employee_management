-- Add stricter RLS policies and data integrity constraints
-- Migration: 20251107000004_stricter_security_policies.sql

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Stricter organization policies
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT WITH CHECK (true); -- Allow anyone to create organizations (for signup)

CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- Stricter organization_members policies
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_members.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin')
    )
  );

CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Stricter employees policies
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

CREATE POLICY "employees_select_policy" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employees.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "employees_insert_policy" ON employees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employees.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "employees_update_policy" ON employees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employees.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "employees_delete_policy" ON employees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employees.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- Stricter user_profiles policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE USING (user_id = auth.uid());

-- Stricter employee_invitations policies
DROP POLICY IF EXISTS "employee_invitations_select_policy" ON employee_invitations;
DROP POLICY IF EXISTS "employee_invitations_insert_policy" ON employee_invitations;
DROP POLICY IF EXISTS "employee_invitations_update_policy" ON employee_invitations;
DROP POLICY IF EXISTS "employee_invitations_delete_policy" ON employee_invitations;

CREATE POLICY "employee_invitations_select_policy" ON employee_invitations
  FOR SELECT USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "employee_invitations_insert_policy" ON employee_invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "employee_invitations_update_policy" ON employee_invitations
  FOR UPDATE USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

CREATE POLICY "employee_invitations_delete_policy" ON employee_invitations
  FOR DELETE USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- Stricter audit_logs policies (only admins can view)
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;

CREATE POLICY "audit_logs_select_policy" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = audit_logs.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin')
    )
  );

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = audit_logs.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Add data integrity constraints
ALTER TABLE employees
  ADD CONSTRAINT employees_email_format CHECK (company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT employees_phone_format CHECK (phone ~* '^\+?[1-9]\d{1,14}$' OR phone IS NULL),
  ADD CONSTRAINT employees_salary_positive CHECK (salary >= 0 OR salary IS NULL),
  ADD CONSTRAINT employees_joining_date_not_future CHECK (joining_date <= CURRENT_DATE);

ALTER TABLE organizations
  ADD CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0),
  ADD CONSTRAINT organizations_email_format CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR contact_email IS NULL);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_email ON employees(company_email);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_code ON employee_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_expires_at ON employee_invitations(expires_at);

-- Add password policy function (for future use with triggers)
-- This function can be used to validate passwords server-side
CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  common_passwords TEXT[] := ARRAY['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
BEGIN
  -- Check minimum length
  IF length(password) < 8 THEN
    RETURN FALSE;
  END IF;

  -- Check for uppercase, lowercase, number, and special character
  IF NOT (password ~ '[A-Z]' AND password ~ '[a-z]' AND password ~ '[0-9]' AND password ~ '[^A-Za-z0-9]') THEN
    RETURN FALSE;
  END IF;

  -- Check for common passwords
  IF password = ANY(common_passwords) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;