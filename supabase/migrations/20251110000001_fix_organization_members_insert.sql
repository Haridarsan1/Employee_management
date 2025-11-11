-- Fix organization_members INSERT policy to avoid recursion
-- Remove the check that references organizations table

DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- SELECT: Users can see their own memberships
CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Users can insert their own membership
CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own memberships
CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can delete their own memberships
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (user_id = auth.uid());