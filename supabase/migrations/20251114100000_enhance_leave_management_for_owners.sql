/*
  Add owner role to leave management policies and create leave_policies table
*/

-- Ensure owners can manage all leave applications
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_applications' AND policyname = 'Owners can manage all leaves'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can manage all leaves" ON public.leave_applications';
  END IF;
END $$;

CREATE POLICY "Owners can manage all leaves"
  ON leave_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_applications.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_applications.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  );

-- Ensure owners can manage leave balances
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_balances' AND policyname = 'Owners can manage all leave balances'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can manage all leave balances" ON public.leave_balances';
  END IF;
END $$;

CREATE POLICY "Owners can manage all leave balances"
  ON leave_balances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_balances.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = leave_balances.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  );

-- Create leave_policies table if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leave_policies' AND table_schema = 'public') THEN
    CREATE TABLE leave_policies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
      department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
      yearly_quota numeric DEFAULT 0,
      carry_forward_enabled boolean DEFAULT false,
      max_carry_forward numeric DEFAULT 0,
      min_notice_days integer DEFAULT 0,
      max_consecutive_days integer DEFAULT 0,
      allow_half_day boolean DEFAULT true,
      deduction_rules jsonb DEFAULT '{}'::jsonb,
      effective_from date,
      effective_until date,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(organization_id, leave_type_id, department_id)
    );
  ELSE
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'organization_id') THEN
      ALTER TABLE leave_policies ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'yearly_quota') THEN
      ALTER TABLE leave_policies ADD COLUMN yearly_quota numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'department_id') THEN
      ALTER TABLE leave_policies ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'carry_forward_enabled') THEN
      ALTER TABLE leave_policies ADD COLUMN carry_forward_enabled boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'max_carry_forward') THEN
      ALTER TABLE leave_policies ADD COLUMN max_carry_forward numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_policies' AND column_name = 'deduction_rules') THEN
      ALTER TABLE leave_policies ADD COLUMN deduction_rules jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

-- Enable RLS on leave_policies
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;

-- Policy for owners/admins to manage leave policies
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_policies' AND policyname = 'Owners and admins can manage leave policies'
  ) THEN
    EXECUTE 'DROP POLICY "Owners and admins can manage leave policies" ON public.leave_policies';
  END IF;
END $$;

CREATE POLICY "Owners and admins can manage leave policies"
  ON leave_policies FOR ALL
  TO authenticated
  USING (
    CASE 
      WHEN organization_id IS NOT NULL THEN 
        is_organization_member(organization_id) AND
        get_user_role_in_organization(organization_id) IN ('owner', 'admin', 'hr')
      ELSE true
    END
  )
  WITH CHECK (
    CASE 
      WHEN organization_id IS NOT NULL THEN 
        is_organization_member(organization_id) AND
        get_user_role_in_organization(organization_id) IN ('owner', 'admin', 'hr')
      ELSE true
    END
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_leave_policies_org ON leave_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_policies_type ON leave_policies(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_policies_dept ON leave_policies(department_id);
