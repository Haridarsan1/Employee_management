-- Run this in Supabase SQL Editor to check current policies
-- This will show you what RLS policies are currently active

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || qual 
        ELSE 'No USING clause' 
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check 
        ELSE 'No WITH CHECK clause' 
    END as with_check_clause
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_members', 'user_profiles')
ORDER BY tablename, policyname;

-- If you see policies with complex USING clauses that reference other tables,
-- those are the recursive ones causing the problem.
-- The correct policies should have simple "auth.uid()" checks only.
