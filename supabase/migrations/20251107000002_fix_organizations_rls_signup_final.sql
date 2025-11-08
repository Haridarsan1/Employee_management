/*
  # Fix Organizations RLS Policy for Signup - Final Fix

  The signup process fails because RLS policies on organizations, organization_members,
  and user_profiles tables require authentication. During signup, the user account is
  created but the session isn't established yet.

  This migration fixes the policies to allow creation during signup.
*/

-- Drop ALL existing policies first (including any that might have been created)
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation for signup" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation during signup" ON organizations;
DROP POLICY IF EXISTS "Users can view accessible organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can delete" ON organizations;

-- Drop organization_members policies
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_members;
DROP POLICY IF EXISTS "Allow organization member creation during signup" ON organization_members;

-- Drop user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow user profile creation during signup" ON user_profiles;

-- Allow anyone to create organizations (needed for signup)
CREATE POLICY "Allow organization creation during signup"
  ON organizations FOR INSERT
  WITH CHECK (owner_id IS NOT NULL);

-- Allow anyone to create organization_members (needed for signup)
CREATE POLICY "Allow organization member creation during signup"
  ON organization_members FOR INSERT
  WITH CHECK (user_id IS NOT NULL AND organization_id IS NOT NULL);

-- Allow anyone to create user_profiles (needed for signup)
CREATE POLICY "Allow user profile creation during signup"
  ON user_profiles FOR INSERT
  WITH CHECK (user_id IS NOT NULL);

-- Allow authenticated users to view organizations they own or are members of
CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
    )
  );

-- Allow organization owners to update their organizations
CREATE POLICY "Organization owners can update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Allow organization owners to delete their organizations
CREATE POLICY "Organization owners can delete"
  ON organizations FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Allow users to view organization members in their organizations
CREATE POLICY "Users can view memberships in their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Allow organization owners to manage members
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

-- Allow users to view and update their own profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());