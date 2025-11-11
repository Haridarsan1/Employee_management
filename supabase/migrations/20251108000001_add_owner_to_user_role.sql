-- Add 'owner' to user_role enum
-- Migration: 20251108000002_add_owner_to_user_role.sql

DO $$
BEGIN
  -- Add 'owner' to user_role enum if it doesn't exist
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'owner'
        AND enumtypid = 'user_role'::regtype
    ) THEN
      ALTER TYPE user_role ADD VALUE 'owner';
    END IF;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add owner to user_role enum: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;