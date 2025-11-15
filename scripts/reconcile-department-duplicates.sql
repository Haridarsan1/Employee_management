-- Reconcile duplicate department codes within the same organization (case-insensitive)
-- Strategy: Keep the first record per (organization_id, lower(code)),
-- and append a short suffix to any conflicting duplicates.

WITH dups AS (
  SELECT id,
         organization_id,
         code,
         lower(code) AS code_lc,
         ROW_NUMBER() OVER (PARTITION BY organization_id, lower(code) ORDER BY created_at NULLS FIRST, id) AS rn
  FROM departments
)
UPDATE departments d
SET code = d.code || '-' || SUBSTRING(d.id::text, 1, 6)
FROM dups
WHERE d.id = dups.id
  AND dups.rn > 1;  -- only mutate true duplicates

-- Show remaining duplicates (should be none)
SELECT organization_id, lower(code) AS code_lc, COUNT(*)
FROM departments
GROUP BY organization_id, lower(code)
HAVING COUNT(*) > 1;