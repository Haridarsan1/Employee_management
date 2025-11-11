-- Complete reset of RLS policies to fix recursion issues

-- Drop all existing policies
DROP POLICY IF EXISTS "organizations_select_owner_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_select_member_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- Organizations policies
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE USING (owner_id = auth.uid());

-- Organization members policies
CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (user_id = auth.uid());