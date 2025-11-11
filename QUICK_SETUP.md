# Quick Setup Guide - Authentication Fix

This guide will help you apply the authentication flow improvements to your Employee Management System.

## What's Fixed

✅ **Infinite Recursion Error** - RLS policies no longer cause recursion
✅ **Admin Signup** - New signups create admin/owner accounts (not employees)
✅ **Employee Onboarding** - Admins can add employees with auto-generated passwords
✅ **Force Password Change** - Employees must change password on first login
✅ **Security** - Strong password requirements enforced

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `APPLY_RLS_FIX.sql`
5. Click **Run** to execute the migration
6. Verify that the query completes successfully

### Option B: Using Supabase CLI
```powershell
# If you have Supabase CLI installed
cd project
supabase db push
```

## Step 2: Clear Browser Data (Important!)

The infinite recursion error may have cached bad states. Clear:
1. **Cookies** - Remove all cookies for `localhost:5173` and your Supabase domain
2. **Local Storage** - Open DevTools → Application → Local Storage → Clear All
3. **Session Storage** - Open DevTools → Application → Session Storage → Clear All

Or use this shortcut:
- Chrome/Edge: Press `Ctrl+Shift+Delete`
- Firefox: Press `Ctrl+Shift+Delete`

## Step 3: Restart Development Server

```powershell
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

## Step 4: Test the Flow

### Test Admin Signup
1. Navigate to http://localhost:5173
2. Click **Get Started** or **Sign Up**
3. Fill in:
   - Organization Name: "Test Company"
   - Email: "admin@testcompany.com"
   - Password: "Admin@123456"
   - Confirm Password: "Admin@123456"
4. Click **Create Account**
5. You should be logged in as an admin with owner role

### Test Employee Addition
1. Once logged in as admin, go to **Employees**
2. Click **Add Employee**
3. Fill in employee details:
   - First Name: "John"
   - Last Name: "Doe"
   - Company Email: "john.doe@testcompany.com" (REQUIRED)
   - Other fields as needed
4. Click **Save Employee**
5. You should see a modal with:
   - Success message
   - Login credentials (email and password)
   - Copy button

### Test Employee First Login
1. **Copy the credentials** from the admin modal
2. Open a new **incognito/private window**
3. Navigate to http://localhost:5173
4. Click **Sign In**
5. Enter the employee credentials
6. You should be redirected to **Change Password** screen
7. Enter a new password (must meet requirements):
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
   - One special character
8. Click **Update Password**
9. You should now access the employee dashboard

## Step 5: Verify No Errors

Check the browser console (F12):
- ✅ No "infinite recursion" errors
- ✅ No 500 errors from Supabase
- ✅ User profile loads successfully
- ✅ Organization data loads successfully

## Troubleshooting

### Still Getting "Infinite Recursion" Error?
1. Verify the SQL migration ran successfully
2. Clear browser data completely
3. Restart the dev server
4. Try signing up with a NEW email address

### Admin Created as Employee Instead of Owner?
1. Check `AuthContext.tsx` line ~372
2. Verify it says `role: 'owner'` not `role: 'admin'` or `role: 'employee'`
3. Delete test users from Supabase Auth dashboard
4. Try signup again

### Employee Not Forced to Change Password?
1. Check that `FirstLoginPasswordChange.tsx` exists in `src/components/Auth/`
2. Check `App.tsx` imports and uses `FirstLoginPasswordChange`
3. Check `AuthContext.tsx` has `requirePasswordChange` logic
4. Clear browser cache and try again

### Credentials Not Showing After Adding Employee?
1. Check browser console for errors
2. Verify `AddEmployeeModal.tsx` has the credentials modal code
3. Check that employee's company email is provided
4. Verify Supabase auth user was created (check Supabase dashboard)

### CORS Errors?
The CORS errors for the edge function are expected and handled. The code falls back to direct database insertion, which works fine with the new RLS policies.

## File Changes Summary

### Modified Files
- ✅ `src/contexts/AuthContext.tsx` - Added password change logic, fixed role
- ✅ `src/components/Employees/AddEmployeeModal.tsx` - Improved password generation
- ✅ `src/App.tsx` - Added FirstLoginPasswordChange integration
- ✅ `src/lib/database.types.ts` - Added proper TypeScript types

### New Files
- ✅ `src/components/Auth/FirstLoginPasswordChange.tsx` - Password change component
- ✅ `supabase/migrations/20251111000000_fix_rls_infinite_recursion_final.sql` - RLS fix
- ✅ `AUTHENTICATION_FLOW.md` - Complete documentation
- ✅ `APPLY_RLS_FIX.sql` - Standalone migration script
- ✅ `QUICK_SETUP.md` - This file

## Next Steps

After successful testing:
1. Review `AUTHENTICATION_FLOW.md` for complete documentation
2. Test with real employee data
3. Set up email templates for credential sharing
4. Configure production Supabase settings
5. Enable email confirmations if needed

## Support

If you encounter any issues:
1. Check browser console for detailed error messages
2. Check Supabase logs in dashboard
3. Verify migrations are applied correctly
4. Review `AUTHENTICATION_FLOW.md` for detailed flow explanation

## Important Security Notes

⚠️ **In Production:**
- Use secure channels to share employee credentials (encrypted email, password managers)
- Enable email confirmations in Supabase Auth settings
- Set up proper email templates
- Configure rate limiting
- Enable 2FA for admin accounts
- Regularly audit user access logs

✅ **Good to Go!**
Your authentication system is now properly configured with admin signup and employee onboarding flows.
