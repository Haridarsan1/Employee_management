-- Fix infinite recursion in RLS policies for signup flow
-- Migration: 20251108000005_fix_infinite_recursion_rls.sql

-- The issue: organizations INSERT policy was checking organization_members,
-- which causes infinite recursion during signup when we need to create
-- organization first, then membership.

-- Drop the problematic policies
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

-- Recreate with proper logic
-- SELECT: Users can see organizations they are members of
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- INSERT: Allow authenticated users to create organizations (for signup)
-- This is safe because the user will become the owner
CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- UPDATE: Only organization admins/owners can update
CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'owner')
    )
  );

-- DELETE: Only organization admins/owners can delete
CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'owner')
    )
  );

-- Fix organization_members policies to avoid recursion
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- SELECT: Users can see members of organizations they belong to
CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- INSERT: Allow authenticated users to create memberships for themselves or
-- admins/owners to add members to their organizations
CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
      )
    )
  );

-- UPDATE: Only the user themselves or admins/owners can update memberships
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

-- DELETE: Only admins/owners can remove members
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

-- Fix user_profiles policies
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
