# Authentication Flow - Employee Management System

## Overview
This document explains the complete authentication flow for the Employee Management System, including admin signup, employee onboarding, and password management.

## 1. Admin Signup Flow

### Step 1: Organization Registration
When an admin signs up:
- Admin provides organization name, email, and password
- Password must meet security requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### Step 2: Account Creation
The system automatically:
1. Creates a Supabase authentication account
2. Creates an organization record
3. Creates a user profile
4. Assigns the user as **'owner'** role (admin privileges)
5. Sets up a 14-day trial subscription

### Step 3: First Login
- Admin logs in with email and password
- Admin is redirected to the dashboard with full administrative access
- Admin can now add employees to the organization

## 2. Employee Onboarding Flow

### Step 1: Admin Adds Employee
Admin navigates to Employees → Add Employee and fills in:
- Personal information (name, email, phone, etc.)
- Employment details (department, designation, joining date)
- Salary information
- Document details

**Important:** Company email is required for employee account creation.

### Step 2: System Creates Employee Account
The system automatically:
1. Generates a secure random password (12 characters with mixed case, numbers, and special characters)
2. Creates a Supabase authentication account with the company email
3. Creates an organization membership with **'employee'** role
4. Creates a user profile
5. Displays the credentials to the admin

### Step 3: Credential Sharing
The admin receives a modal with:
- Employee's email (company_email)
- Generated temporary password
- Copy button to copy credentials to clipboard

**Admin must securely share these credentials with the employee.**

### Step 4: Employee First Login
When the employee logs in for the first time:
1. System detects it's the first login (last_sign_in_at == created_at)
2. System checks if user has 'employee' role
3. Employee is automatically redirected to the **Change Password** screen
4. Employee cannot access the dashboard until password is changed

### Step 5: Password Change (Mandatory)
The FirstLoginPasswordChange screen shows:
- Clear instructions that this is mandatory for security
- New password field with strength indicator
- Confirm password field
- Real-time password validation
- Requirements checklist:
  - ✓ At least 8 characters
  - ✓ One uppercase letter
  - ✓ One lowercase letter
  - ✓ One number
  - ✓ One special character

### Step 6: Access Dashboard
After successfully changing the password:
- The `requirePasswordChange` flag is cleared
- Employee is granted access to the dashboard
- Employee can now use the system with their new password

## 3. Role-Based Access

### Owner/Admin Role
- Full system access
- Can add, edit, delete employees
- Can manage organization settings
- Can process payroll
- Can approve/reject leave requests
- Can view all reports
- Can manage roles and permissions

### Employee Role
- View own profile and information
- Mark attendance
- Request leave
- View own payslips
- View assigned tasks
- Submit expenses
- Limited dashboard view

## 4. Database Structure

### Key Tables
1. **organizations** - Stores organization information
2. **user_profiles** - Links Supabase auth users to organizations
3. **organization_members** - Defines user roles within organizations
4. **employees** - Stores detailed employee information

### RLS Policies
The system uses Row Level Security (RLS) to ensure:
- Users can only see data from their organization
- Admins have full access to organization data
- Employees can only see their own data
- No infinite recursion in policy checks

## 5. Security Features

### Password Security
- Strong password requirements enforced
- Passwords hashed by Supabase Auth
- Temporary passwords are randomly generated
- Force password change on first login for employees

### Audit Logging
All critical actions are logged:
- Employee creation
- Auth user creation
- Password changes
- Organization changes

### Multi-Tenancy
- Complete data isolation between organizations
- Users belong to specific organizations
- No cross-organization data access

## 6. Migration Files

### Latest Migration: `20251111000000_fix_rls_infinite_recursion_final.sql`
This migration fixes the infinite recursion issue in RLS policies by:
- Removing recursive checks from organization_members policies
- Allowing direct inserts during signup/onboarding
- Implementing secure, non-recursive policies
- Adding helper function for admin checks

## 7. Troubleshooting

### Issue: "Infinite recursion detected in policy"
**Solution:** Run the latest migration to fix RLS policies.

### Issue: Employee can't change password
**Solution:** Check that the FirstLoginPasswordChange component is properly imported in App.tsx.

### Issue: Admin created as 'user' instead of 'owner'
**Solution:** Check that signUp function in AuthContext creates membership with 'owner' role.

### Issue: Credentials not displayed after adding employee
**Solution:** Check that AddEmployeeModal properly generates and displays credentials in the success modal.

## 8. Best Practices

### For Admins
- Securely communicate credentials to employees (use encrypted channels)
- Advise employees to change password immediately
- Regularly review user roles and permissions
- Monitor audit logs for suspicious activities

### For Employees
- Change your password immediately after first login
- Use a strong, unique password
- Never share your credentials
- Log out after each session

### For Developers
- Always test authentication flows after changes
- Run migrations in order
- Check RLS policies don't cause recursion
- Implement proper error handling
- Log important actions for auditing

## 9. Code Files Modified

1. **src/contexts/AuthContext.tsx**
   - Added `requirePasswordChange` state
   - Changed signup role from 'admin' to 'owner'
   - Added first-login detection logic
   - Added password change tracking

2. **src/components/Auth/FirstLoginPasswordChange.tsx**
   - New component for mandatory password change
   - Password strength indicator
   - Real-time validation

3. **src/components/Employees/AddEmployeeModal.tsx**
   - Improved password generation (ensures all character types)
   - Enhanced credentials display modal
   - Better user feedback

4. **src/App.tsx**
   - Added FirstLoginPasswordChange route
   - Integrated requirePasswordChange check

5. **src/lib/database.types.ts**
   - Added proper TypeScript types
   - Added 'owner' to UserRole type

6. **supabase/migrations/20251111000000_fix_rls_infinite_recursion_final.sql**
   - Fixed RLS infinite recursion
   - Simplified policies for signup flow

## 10. Testing Checklist

- [ ] Admin can signup and creates organization
- [ ] Admin is assigned 'owner' role
- [ ] Admin can access full dashboard
- [ ] Admin can add employees
- [ ] System generates secure passwords
- [ ] Admin sees credentials modal
- [ ] Employee can login with temporary password
- [ ] Employee is forced to change password
- [ ] Employee can change password successfully
- [ ] Employee can access dashboard after password change
- [ ] RLS policies work without recursion errors
- [ ] Audit logs are created for all actions

## Support

For issues or questions, please check:
1. Console logs for detailed error messages
2. Supabase dashboard for auth and database issues
3. Migration files are run in order
4. RLS policies are correctly applied
