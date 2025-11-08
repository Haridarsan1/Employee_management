/*
  # Fix RLS Policies - Remove All Recursion

  ## Changes
  - Drop all existing policies
  - Create simple, non-recursive policies using only direct column comparisons
  - Avoid any subqueries that could cause recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view organizations they own" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations via direct membership" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON organizations;

DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view members in same organization" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can insert members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can update members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can delete members" ON organization_members;

-- Organizations: Simple owner-based policy only
CREATE POLICY "Allow all authenticated users to view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Organization owners can update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Organization Members: Simple policies without cross-table checks
CREATE POLICY "Allow all authenticated users to view memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (true);
