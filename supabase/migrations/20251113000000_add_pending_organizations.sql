-- Store pending organization creation for users who need email confirmation
-- This ensures we don't lose the organization name between signup and email confirmation

CREATE TABLE IF NOT EXISTS pending_organizations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE pending_organizations ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own pending org
CREATE POLICY "Users can insert own pending org"
  ON pending_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own pending org
CREATE POLICY "Users can read own pending org"
  ON pending_organizations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to delete their own pending org
CREATE POLICY "Users can delete own pending org"
  ON pending_organizations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Clean up expired pending organizations (run daily via cron or manual cleanup)
-- This is just the function, you'd need to set up pg_cron or call it manually
CREATE OR REPLACE FUNCTION cleanup_expired_pending_organizations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pending_organizations
  WHERE expires_at < now();
END;
$$;
