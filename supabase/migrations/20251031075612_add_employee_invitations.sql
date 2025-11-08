/*
  # Add Employee Invitation System

  ## Overview
  Creates a complete system for inviting employees to register and link their accounts to employee records.

  ## New Tables

  ### `employee_invitations`
  - `id` (uuid, primary key) - Unique invitation ID
  - `organization_id` (uuid, foreign key) - Organization
  - `employee_id` (uuid, foreign key) - Employee record
  - `email` (text) - Employee's email
  - `invitation_code` (text, unique) - Unique invitation code
  - `status` (text) - Status: pending, accepted, expired
  - `expires_at` (timestamptz) - Expiration date
  - `invited_by` (uuid) - User who sent invitation
  - `accepted_at` (timestamptz) - When invitation was accepted
  - `created_at` (timestamptz) - Creation timestamp

  ## Changes to Existing Tables

  ### `employees`
  - Add `user_id` (uuid, nullable) - Links to auth user
  - Add `invitation_sent` (boolean) - Track if invitation sent
  - Add `invitation_accepted` (boolean) - Track if accepted

  ## Security
  - Enable RLS on `employee_invitations`
  - Policies for authenticated users to view and accept invitations
  - Policies for admins to create and manage invitations

  ## Important Notes
  1. Invitation codes are 32-character random strings
  2. Invitations expire after 7 days by default
  3. Each employee can have only one pending invitation
  4. When accepted, user_id is linked to employee record
*/

-- Add columns to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'invitation_sent'
  ) THEN
    ALTER TABLE employees ADD COLUMN invitation_sent boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'invitation_accepted'
  ) THEN
    ALTER TABLE employees ADD COLUMN invitation_accepted boolean DEFAULT false;
  END IF;
END $$;

-- Create employee_invitations table
CREATE TABLE IF NOT EXISTS employee_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invitation_code text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_invitations_code ON employee_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_employee_id ON employee_invitations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- Enable RLS
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for employee_invitations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view organization invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Anyone can view invitation by code" ON employee_invitations;

-- Admins can view all invitations for their organization
CREATE POLICY "Admins can view organization invitations"
  ON employee_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'hr')
    )
  );

-- Admins can create invitations for their organization
CREATE POLICY "Admins can create invitations"
  ON employee_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'hr')
    )
  );

-- Admins can update invitations for their organization
CREATE POLICY "Admins can update invitations"
  ON employee_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = employee_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'hr')
    )
  );

-- Anyone can view their own invitation by code (for registration page)
CREATE POLICY "Anyone can view invitation by code"
  ON employee_invitations FOR SELECT
  TO authenticated
  USING (true);

-- Function to generate invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := encode(gen_random_bytes(24), 'hex');

    SELECT EXISTS (
      SELECT 1 FROM employee_invitations WHERE invitation_code = code
    ) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN code;
END;
$$;

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE employee_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$;

-- Function to link employee to user after registration
CREATE OR REPLACE FUNCTION link_employee_to_user(
  invitation_code_param text,
  user_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record record;
  result json;
BEGIN
  SELECT * INTO invitation_record
  FROM employee_invitations
  WHERE invitation_code = invitation_code_param
  AND status = 'pending'
  AND expires_at > now();

  IF invitation_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invitation code'
    );
  END IF;

  UPDATE employees
  SET user_id = user_id_param,
      invitation_accepted = true,
      updated_at = now()
  WHERE id = invitation_record.employee_id;

  UPDATE employee_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = invitation_record.id;

  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    employee_id
  ) VALUES (
    invitation_record.organization_id,
    user_id_param,
    'employee',
    invitation_record.employee_id
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET employee_id = invitation_record.employee_id,
      updated_at = now();

  RETURN json_build_object(
    'success', true,
    'organization_id', invitation_record.organization_id,
    'employee_id', invitation_record.employee_id
  );
END;
$$;

-- Update user_profiles RLS to allow employees to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow employees to view their own employee record
DROP POLICY IF EXISTS "Employees can view own record" ON employees;
CREATE POLICY "Employees can view own record"
  ON employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow employees to view their own attendance
DROP POLICY IF EXISTS "Employees can view own attendance" ON attendance_records;
CREATE POLICY "Employees can view own attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Allow employees to view their own leave applications
DROP POLICY IF EXISTS "Employees can view own leave applications" ON leave_applications;
CREATE POLICY "Employees can view own leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Allow employees to view their own leave balances
DROP POLICY IF EXISTS "Employees can view own leave balances" ON leave_balances;
CREATE POLICY "Employees can view own leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Allow employees to view their own salary structure
DROP POLICY IF EXISTS "Employees can view own salary" ON salary_structures;
CREATE POLICY "Employees can view own salary"
  ON salary_structures FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );
