/*
  # Fix Organizations RLS Policy for Signup

  The current RLS policy for organizations prevents new users from creating organizations
  during signup because the user is not fully authenticated yet.

  This migration updates the policy to allow organization creation.
*/

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Create a more permissive policy for organization creation
CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Keep the other policies as they are
-- Users can still only update/delete their own organizations