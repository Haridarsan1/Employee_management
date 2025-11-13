-- Fix: Allow organization members (employees) to read their organization
-- This fixes the issue where employees cannot load the organization data

-- Drop the existing owner-only select policy
DROP POLICY IF EXISTS "organizations_select_owner_policy" ON organizations;

-- Create a new policy that allows both owners AND members to read organizations
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT 
  USING (
    -- Owner can see their organization
    owner_id = auth.uid()
    OR
    -- Members can see organizations they belong to
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );
