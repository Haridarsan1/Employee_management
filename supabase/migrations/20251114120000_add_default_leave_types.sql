-- Add default leave types for organizations
-- This migration adds common leave types that can be used across organizations

-- First, add color column to leave_types if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_types' AND column_name = 'color'
  ) THEN
    ALTER TABLE leave_types ADD COLUMN color text DEFAULT '#3B82F6';
  END IF;
END $$;

-- Drop old unique constraints if they exist and add composite constraints
DO $$
BEGIN
  -- Drop old unique constraint on name if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_name_key'
  ) THEN
    ALTER TABLE leave_types DROP CONSTRAINT leave_types_name_key;
  END IF;
  
  -- Drop old unique constraint on code if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_code_key'
  ) THEN
    ALTER TABLE leave_types DROP CONSTRAINT leave_types_code_key;
  END IF;
  
  -- Add composite unique constraint on organization_id and code if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_org_code_key'
  ) THEN
    ALTER TABLE leave_types ADD CONSTRAINT leave_types_org_code_key UNIQUE (organization_id, code);
  END IF;
END $$;

-- Function to add default leave types for an organization
CREATE OR REPLACE FUNCTION add_default_leave_types(org_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default leave types if they don't exist for this organization
  INSERT INTO leave_types (organization_id, name, code, color, description, is_active, is_paid)
  VALUES
    (org_id, 'Casual Leave', 'CL', '#3B82F6', 'Short-term personal leave for casual purposes', true, true),
    (org_id, 'Sick Leave', 'SL', '#EF4444', 'Leave for illness or medical appointments', true, true),
    (org_id, 'Earned Leave', 'EL', '#10B981', 'Accumulated leave earned through service', true, true),
    (org_id, 'Unpaid Leave', 'UL', '#6B7280', 'Leave without pay', true, false),
    (org_id, 'Maternity Leave', 'ML', '#EC4899', 'Leave for maternity purposes', true, true),
    (org_id, 'Paternity Leave', 'PL', '#8B5CF6', 'Leave for paternity purposes', true, true),
    (org_id, 'Comp Off', 'CO', '#F59E0B', 'Compensatory off for overtime work', true, true)
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add default leave types for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations
  LOOP
    PERFORM add_default_leave_types(org_record.id);
  END LOOP;
END $$;

-- Create trigger to automatically add default leave types when a new organization is created
CREATE OR REPLACE FUNCTION trigger_add_default_leave_types()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_default_leave_types(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_organization_created_add_leave_types ON organizations;
CREATE TRIGGER on_organization_created_add_leave_types
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_add_default_leave_types();

COMMENT ON FUNCTION add_default_leave_types IS 'Adds default leave types for an organization';
COMMENT ON FUNCTION trigger_add_default_leave_types IS 'Trigger function to add default leave types when organization is created';
