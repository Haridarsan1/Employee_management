-- Add setup_completed flag to organizations table
-- This flag tracks whether the owner has completed the initial master data setup

DO $$ 
BEGIN
    -- Add setup_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations' 
        AND column_name = 'setup_completed'
    ) THEN
        ALTER TABLE organizations 
        ADD COLUMN setup_completed boolean DEFAULT false;
        
        COMMENT ON COLUMN organizations.setup_completed IS 
        'Indicates whether the organization has completed initial setup (departments, designations)';
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_organizations_setup_completed 
ON organizations(setup_completed) 
WHERE setup_completed = false;
