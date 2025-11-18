-- Migration: Add organization_id to leave_applications table for strict organization isolation
-- This ensures leave requests are properly scoped to organizations

-- Add organization_id column to leave_applications
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_applications' AND column_name = 'organization_id'
  ) THEN
    -- Add the column
    ALTER TABLE leave_applications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Populate organization_id from employee relationship
    UPDATE leave_applications la
    SET organization_id = e.organization_id
    FROM employees e
    WHERE la.employee_id = e.id AND la.organization_id IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE leave_applications ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_leave_applications_organization_id ON leave_applications(organization_id);
  END IF;
END $$;

-- Update RLS policies for leave_applications to use organization_id
DROP POLICY IF EXISTS "Users can view leave applications in their organization" ON leave_applications;
CREATE POLICY "Users can view leave applications in their organization"
  ON leave_applications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own leave applications" ON leave_applications;
CREATE POLICY "Users can insert their own leave applications"
  ON leave_applications FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM organization_members 
      WHERE user_id = auth.uid() AND employee_id IS NOT NULL
    )
    AND organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own pending leave applications" ON leave_applications;
CREATE POLICY "Users can update their own pending leave applications"
  ON leave_applications FOR UPDATE
  USING (
    employee_id IN (
      SELECT employee_id FROM organization_members 
      WHERE user_id = auth.uid() AND employee_id IS NOT NULL
    )
    AND organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Managers can update leave applications in their organization" ON leave_applications;
CREATE POLICY "Managers can update leave applications in their organization"
  ON leave_applications FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

-- Add trigger to automatically set organization_id on insert
CREATE OR REPLACE FUNCTION set_leave_application_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If organization_id is not provided, get it from the employee
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM employees
    WHERE id = NEW.employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_leave_application_organization_id ON leave_applications;
CREATE TRIGGER trigger_set_leave_application_organization_id
  BEFORE INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_application_organization_id();

-- Add organization_id to leave_balances if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_balances' AND column_name = 'organization_id'
  ) THEN
    -- Add the column
    ALTER TABLE leave_balances ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Populate organization_id from employee relationship
    UPDATE leave_balances lb
    SET organization_id = e.organization_id
    FROM employees e
    WHERE lb.employee_id = e.id AND lb.organization_id IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE leave_balances ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_leave_balances_organization_id ON leave_balances(organization_id);
  END IF;
END $$;

-- Update RLS policies for leave_balances
DROP POLICY IF EXISTS "Users can view leave balances in their organization" ON leave_balances;
CREATE POLICY "Users can view leave balances in their organization"
  ON leave_balances FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage leave balances in their organization" ON leave_balances;
CREATE POLICY "Managers can manage leave balances in their organization"
  ON leave_balances FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

-- Add trigger to automatically set organization_id on leave_balances insert
CREATE OR REPLACE FUNCTION set_leave_balance_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If organization_id is not provided, get it from the employee
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM employees
    WHERE id = NEW.employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_leave_balance_organization_id ON leave_balances;
CREATE TRIGGER trigger_set_leave_balance_organization_id
  BEFORE INSERT ON leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_balance_organization_id();

-- Ensure leave_types are scoped to organizations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_types' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- For existing leave types without organization_id, you may need to handle them
    -- Option 1: Delete them if they're not used
    -- Option 2: Assign them to a specific organization
    -- Option 3: Keep them as global (leave organization_id as NULL for system-wide types)
    
    -- For now, we'll allow NULL for global leave types
    -- But create an index
    CREATE INDEX IF NOT EXISTS idx_leave_types_organization_id ON leave_types(organization_id);
  END IF;
END $$;

-- Update RLS for leave_types to allow viewing global types and organization-specific types
DROP POLICY IF EXISTS "Users can view leave types" ON leave_types;
CREATE POLICY "Users can view leave types"
  ON leave_types FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage organization leave types" ON leave_types;
CREATE POLICY "Managers can manage organization leave types"
  ON leave_types FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr')
    )
  );
