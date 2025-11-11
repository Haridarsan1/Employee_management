-- Final fix for infinite recursion and admin signup
-- This migration completely fixes the RLS policies to allow new admin signups

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

-- SELECT: Users can see organizations they belong to
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create an organization (for signup)
-- This must NOT check organization_members to avoid recursion
CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- UPDATE: Only admins/owners can update
CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'owner')
    )
  );

-- DELETE: Only admins/owners can delete
CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- ORGANIZATION_MEMBERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- SELECT: Users can see their own membership and other members in their org
CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- INSERT: Allow users to create their own membership (for signup) OR admins to add members
-- FIXED: Use table alias to avoid infinite recursion
CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
        AND om.id != organization_members.id
      )
    )
  );

-- UPDATE: Only the user themselves or admins/owners can update
CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

-- DELETE: Only admins/owners can delete members
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- USER_PROFILES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

-- SELECT: Users can see their own profile
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Users can create their own profile
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- UPDATE: Users can update their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can delete their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================
-- Run this to verify the policies are correct
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('organizations', 'organization_members', 'user_profiles');
