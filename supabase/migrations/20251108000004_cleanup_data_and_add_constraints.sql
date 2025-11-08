-- Clean up existing data and add data integrity constraints
-- Migration: 20251108000004_cleanup_data_and_add_constraints.sql

-- First, clean up invalid data in employees table
-- Fix invalid emails (set to NULL if they don't match email format)
UPDATE employees
SET company_email = NULL
WHERE company_email IS NOT NULL
  AND company_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

-- Fix invalid phone numbers (set to NULL if they don't match phone format)
UPDATE employees
SET mobile_number = NULL
WHERE mobile_number IS NOT NULL
  AND mobile_number !~* '^\+?[1-9]\d{1,14}$';

-- Fix negative salaries (set to NULL)
UPDATE employees
SET basic_salary = NULL
WHERE basic_salary < 0;

-- Fix future joining dates (set to current date)
UPDATE employees
SET date_of_joining = CURRENT_DATE
WHERE date_of_joining > CURRENT_DATE;

-- Clean up invalid data in organizations table
-- Fix empty or null organization names (set to 'Unnamed Organization')
UPDATE organizations
SET name = 'Unnamed Organization'
WHERE name IS NULL OR length(trim(name)) = 0;

-- Fix invalid contact emails
UPDATE organizations
SET email = NULL
WHERE email IS NOT NULL
  AND email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

-- Now add the data integrity constraints
ALTER TABLE employees
  ADD CONSTRAINT employees_email_format CHECK (company_email IS NULL OR company_email = '' OR company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT employees_phone_format CHECK (mobile_number IS NULL OR mobile_number = '' OR mobile_number ~* '^\+?[1-9]\d{1,14}$'),
  ADD CONSTRAINT employees_salary_positive CHECK (basic_salary IS NULL OR basic_salary >= 0),
  ADD CONSTRAINT employees_joining_date_not_future CHECK (date_of_joining IS NULL OR date_of_joining <= CURRENT_DATE);

ALTER TABLE organizations
  ADD CONSTRAINT organizations_name_not_empty CHECK (name IS NOT NULL AND length(trim(name)) > 0),
  ADD CONSTRAINT organizations_email_format CHECK (email IS NULL OR email = '' OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');