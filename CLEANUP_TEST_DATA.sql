-- Clean up test data
-- Run this AFTER running FORCE_FIX_RLS.sql

BEGIN;

-- Delete test organization members
DELETE FROM organization_members 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%test%' OR email = 'pixelfactory11@gmail.com'
);

-- Delete test user profiles
DELETE FROM user_profiles 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%test%' OR email = 'pixelfactory11@gmail.com'
);

-- Delete test organizations (optional - only if you want clean slate)
DELETE FROM organizations 
WHERE owner_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%test%' OR email = 'pixelfactory11@gmail.com'
);

COMMIT;

-- Then manually delete users from Authentication > Users in Supabase Dashboard
