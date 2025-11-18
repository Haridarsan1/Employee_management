-- Migration: Add approved_by and approved_date columns to leave_applications
-- These columns are used to track who approved/rejected the leave and when

DO $$ 
BEGIN
  -- Add approved_by column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_applications' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE leave_applications ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    
    -- Migrate data from reviewed_by to approved_by if reviewed_by exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leave_applications' AND column_name = 'reviewed_by'
    ) THEN
      UPDATE leave_applications 
      SET approved_by = reviewed_by 
      WHERE reviewed_by IS NOT NULL AND approved_by IS NULL;
    END IF;
  END IF;

  -- Add approved_date column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_applications' AND column_name = 'approved_date'
  ) THEN
    ALTER TABLE leave_applications ADD COLUMN approved_date timestamptz;
    
    -- Migrate data from reviewed_at to approved_date if reviewed_at exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leave_applications' AND column_name = 'reviewed_at'
    ) THEN
      UPDATE leave_applications 
      SET approved_date = reviewed_at 
      WHERE reviewed_at IS NOT NULL AND approved_date IS NULL;
    END IF;
  END IF;
  
  -- Add rejected_reason column if not exists (if it's named rejection_reason)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_applications' AND column_name = 'rejected_reason'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leave_applications' AND column_name = 'rejection_reason'
    ) THEN
      -- Rename rejection_reason to rejected_reason for consistency
      ALTER TABLE leave_applications RENAME COLUMN rejection_reason TO rejected_reason;
    ELSE
      -- Add rejected_reason column
      ALTER TABLE leave_applications ADD COLUMN rejected_reason text;
    END IF;
  END IF;

END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_applications_approved_by ON leave_applications(approved_by);
CREATE INDEX IF NOT EXISTS idx_leave_applications_approved_date ON leave_applications(approved_date);
