-- Fix departments unique constraint for multi-tenancy
-- Previous constraint: departments_code_key (global uniqueness on code)
-- Problem: Blocks different organizations from reusing same department code.
-- Solution: Enforce uniqueness scoped to organization (case-insensitive).

DO $$
BEGIN
  -- Drop old global unique constraint if present
  BEGIN
    EXECUTE 'ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key';
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  -- Resolve any duplicates within the same organization (case-insensitive)
  -- Keep the first row per (org, lower(code)), suffix the rest to make them unique
  WITH dups AS (
    SELECT id,
           organization_id,
           code,
           lower(code) AS code_lc,
           ROW_NUMBER() OVER (PARTITION BY organization_id, lower(code) ORDER BY id) AS rn
    FROM departments
  )
  UPDATE departments d
  SET code = d.code || '-' || SUBSTRING(d.id::text, 1, 6)
  FROM dups
  WHERE d.id = dups.id AND dups.rn > 1;

  -- Create per-organization unique index (case-insensitive)
  CREATE UNIQUE INDEX IF NOT EXISTS departments_org_code_unique
    ON departments (organization_id, lower(code));
END $$;

-- Verification query (run after migration):
-- SELECT organization_id, code, COUNT(*)
-- FROM departments
-- GROUP BY organization_id, code
-- HAVING COUNT(*) > 1;
