-- FORCE FIX for infinite recursion
-- Run this if APPLY_RLS_FIX.sql didn't work
-- This completely resets the RLS policies

BEGIN;

-- ====================================
-- STEP 1: Disable RLS temporarily
-- ====================================
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- ====================================
-- STEP 2: Drop ALL policies
-- ====================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all policies on organizations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON organizations';
    END LOOP;
    
    -- Drop all policies on organization_members
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organization_members') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON organization_members';
    END LOOP;
    
    -- Drop all policies on user_profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_profiles';
    END LOOP;
END $$;

-- ====================================
-- STEP 3: Re-enable RLS
-- ====================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ====================================
-- STEP 4: Create SIMPLE non-recursive policies
-- ====================================

-- ORGANIZATIONS policies
CREATE POLICY "orgs_insert_all" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "orgs_select_owner" ON organizations
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "orgs_update_owner" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "orgs_delete_owner" ON organizations
  FOR DELETE USING (owner_id = auth.uid());

-- ORGANIZATION_MEMBERS policies (NO RECURSION - VERY IMPORTANT!)
CREATE POLICY "members_insert_all" ON organization_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "members_select_own" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members_update_own" ON organization_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "members_delete_own" ON organization_members
  FOR DELETE USING (user_id = auth.uid());

-- USER_PROFILES policies
CREATE POLICY "profiles_insert_all" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_select_own" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "profiles_delete_own" ON user_profiles
  FOR DELETE USING (user_id = auth.uid());

COMMIT;

-- Verify the new policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_members', 'user_profiles')
ORDER BY tablename, policyname;
