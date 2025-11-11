-- Fix all organization_members policies to avoid recursion
-- Remove owner checks that reference organizations table

DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- UPDATE: Users can update their own memberships
CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can delete their own memberships
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (user_id = auth.uid());