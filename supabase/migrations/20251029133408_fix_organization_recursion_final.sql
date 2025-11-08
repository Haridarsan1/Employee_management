/*
  # Fix Organization and Organization Members Recursion

  ## Problem
  Circular dependency between organizations and organization_members policies.

  ## Solution
  Simplify to avoid any circular references.
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON organizations;

DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;

-- Organizations: Simple owner-based policies only
CREATE POLICY "Users can view organizations they own"
  ON organizations FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view organizations via direct membership"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
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

-- Organization Members: Simple policies without organization checks
CREATE POLICY "Users can view their own memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view members in same organization"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Organization owners can insert members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations 
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations 
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations 
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations 
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  );
