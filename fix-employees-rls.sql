-- Fix RLS policies for employees table to allow email-based lookup
-- This allows employees to find their own record by email during auto-linking

-- Drop existing problematic policies if any
DROP POLICY IF EXISTS "Employees can view own organization employees" ON employees;
DROP POLICY IF EXISTS "Users can view employees in their organization" ON employees;

-- Policy: Allow users to view employees in their organization
-- This includes looking up by email for auto-linking
CREATE POLICY "Users can view employees in their organization"
ON employees
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Allow users to find their own employee record by company_email
  company_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Policy: Allow users to update their own employee record (for auto-linking)
CREATE POLICY "Users can update own employee record"
ON employees
FOR UPDATE
USING (
  company_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR
  user_id = auth.uid()
)
WITH CHECK (
  company_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR
  user_id = auth.uid()
);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;
