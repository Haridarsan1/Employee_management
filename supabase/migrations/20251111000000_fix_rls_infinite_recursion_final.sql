-- Fix infinite recursion in RLS policies
-- This migration completely removes recursive checks from organization_members policies

-- Drop all existing policies on organizations and organization_members
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_select_owner_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_select_member_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- =====================================================
-- ORGANIZATIONS TABLE POLICIES (No recursion)
-- =====================================================

-- Allow anyone to insert organizations (needed for signup)
CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT 
  WITH CHECK (true);

-- Users can select organizations they own
CREATE POLICY "organizations_select_owner_policy" ON organizations
  FOR SELECT 
  USING (owner_id = auth.uid());

-- Users can update organizations they own
CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE 
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete organizations they own
CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE 
  USING (owner_id = auth.uid());

-- =====================================================
-- ORGANIZATION_MEMBERS TABLE POLICIES (No recursion)
-- =====================================================

-- Allow anyone to insert organization_members (needed for signup and adding employees)
CREATE POLICY "organization_members_insert_policy" ON organization_members
  FOR INSERT 
  WITH CHECK (true);

-- Users can select their own memberships
CREATE POLICY "organization_members_select_policy" ON organization_members
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can update their own memberships
CREATE POLICY "organization_members_update_policy" ON organization_members
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only allow deletion of own membership records
CREATE POLICY "organization_members_delete_policy" ON organization_members
  FOR DELETE 
  USING (user_id = auth.uid());

-- =====================================================
-- USER_PROFILES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

-- Allow anyone to insert user profiles (needed for signup)
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT 
  WITH CHECK (true);

-- Users can select their own profile
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE 
  USING (user_id = auth.uid());

-- =====================================================
-- Add helper function to check if user is admin (no recursion)
-- =====================================================

CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND organization_members.user_id = user_id 
    AND role IN ('admin', 'owner')
    AND is_active = true
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_organization_admin TO authenticated;

-- Comment for reference
COMMENT ON FUNCTION is_organization_admin IS 'Check if user is admin of organization without causing recursion';
