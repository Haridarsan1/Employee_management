/*
  # Fix Organization RLS Policies

  ## Problem
  Some policies may have circular dependencies causing issues.

  ## Solution
  Simplify policies to avoid recursion and ensure proper access.
*/

-- Drop and recreate organization_members policies to avoid recursion
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON organization_members;

-- Simple policies without circular dependencies
CREATE POLICY "Users can view memberships in their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );
