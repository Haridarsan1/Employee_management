-- Add optional remarks column for approval notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_applications' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE leave_applications ADD COLUMN remarks text;
  END IF;
END $$;