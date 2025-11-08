-- Add organization_id column to existing audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Update existing records to have organization_id from user membership (if possible)
UPDATE audit_logs
SET organization_id = (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = audit_logs.user_id
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.role = 'admin'
    AND organization_members.organization_id = audit_logs.organization_id
  )
);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action VARCHAR(50),
  p_table_name VARCHAR(50),
  p_record_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- If organization_id not provided, try to get it from membership
  IF p_organization_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM organization_members
    WHERE user_id = v_user_id
    LIMIT 1;
  ELSE
    v_org_id := p_organization_id;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id, organization_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    v_user_id, v_org_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;