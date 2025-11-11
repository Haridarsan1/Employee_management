-- Fix infinite recursion in organization_members RLS policies
-- Replace self-referencing policies with organization-based checks

-- ============================================================================
-- ORGANIZATIONS TABLE - Allow owners to see their organizations
-- ============================================================================

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;

-- SELECT: Owners can see their organizations
CREATE POLICY "organizations_select_owner_policy" ON organizations
  FOR SELECT USING (owner_id = auth.uid());

-- SELECT: Members can see organizations they belong to
CREATE POLICY "organizations_select_member_policy" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

-- ============================================================================
-- ORGANIZATION_MEMBERS TABLE - Fix Recursion
-- ============================================================================

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

-- UPDATE: Owners can update memberships in their organizations
CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = organization_members.organization_id
      AND organizations.owner_id = auth.uid()
    )
  );

-- DELETE: Owners can delete memberships in their organizations
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = organization_members.organization_id
      AND organizations.owner_id = auth.uid()
    )
  );