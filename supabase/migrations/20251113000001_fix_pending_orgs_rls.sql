-- Fix RLS for pending_organizations to handle edge cases
-- This allows both authenticated users and service role to access the table

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own pending org" ON pending_organizations;
DROP POLICY IF EXISTS "Users can read own pending org" ON pending_organizations;
DROP POLICY IF EXISTS "Users can delete own pending org" ON pending_organizations;

-- Recreate with better permissions
CREATE POLICY "Users can insert own pending org"
  ON pending_organizations
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() = user_id OR current_setting('role') = 'service_role');

CREATE POLICY "Users can read own pending org"
  ON pending_organizations
  FOR SELECT
  TO authenticated, service_role
  USING (auth.uid() = user_id OR current_setting('role') = 'service_role');

CREATE POLICY "Users can delete own pending org"
  ON pending_organizations
  FOR DELETE
  TO authenticated, service_role
  USING (auth.uid() = user_id OR current_setting('role') = 'service_role');
