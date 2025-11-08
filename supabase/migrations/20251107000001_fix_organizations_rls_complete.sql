/*
  # Fix Organizations RLS Policies for Signup Flow

  The current RLS policies are too restrictive for the signup process.
  This migration provides proper policies that allow:
  1. Organization creation during signup
  2. Proper access control for organization owners and members
*/

-- Drop all existing organization policies
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON organizations;

-- Enable RLS (in case it was disabled)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create organizations (needed for signup)
CREATE POLICY "Allow organization creation"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view organizations they own or are members of
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

-- Allow organization owners to delete their organizations (optional)
CREATE POLICY "Organization owners can delete"
  ON organizations FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());