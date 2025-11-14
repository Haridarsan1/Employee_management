-- Manual Employee Account Linking
-- This SQL will link the existing employee record to the user account
-- Run this in Supabase SQL Editor

-- First, let's find the employee record
-- Replace 'employee_email@example.com' with the actual employee's email
SELECT id, full_name, email, user_id, organization_id 
FROM employees 
WHERE organization_id = '5b7371d1-d98d-4553-947e-219ee9eec16e';

-- After identifying the correct employee_id from above,
-- Update the employee record with the user_id
-- Replace 'EMPLOYEE_ID_HERE' with the actual employee id from the query above
UPDATE employees 
SET user_id = '1e5e5c95-fc7e-4b91-b156-ef90afe41557'
WHERE id = 'EMPLOYEE_ID_HERE'  -- Replace with actual employee id
  AND organization_id = '5b7371d1-d98d-4553-947e-219ee9eec16e';

-- Verify the update
SELECT id, full_name, email, user_id, organization_id 
FROM employees 
WHERE user_id = '1e5e5c95-fc7e-4b91-b156-ef90afe41557';

-- Also ensure the organization_members entry exists
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  '5b7371d1-d98d-4553-947e-219ee9eec16e',
  '1e5e5c95-fc7e-4b91-b156-ef90afe41557',
  'employee'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Verify organization membership
SELECT * FROM organization_members 
WHERE user_id = '1e5e5c95-fc7e-4b91-b156-ef90afe41557';
