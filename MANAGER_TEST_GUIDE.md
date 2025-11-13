# 🚀 Employee Management System - Ready for Testing

## Production URL
**Live App**: https://employeemanagement-lemon.vercel.app

---

## ⚠️ CRITICAL: Complete These Steps BEFORE Testing

### Step 1: Configure Supabase Redirect URLs (REQUIRED)

**Why**: Email confirmations currently redirect to localhost (causing 404 errors)

**Action Required**:
1. Go to: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/auth/url-configuration
2. Update **Site URL**:
   - Change from: `http://localhost:3000`
   - Change to: `https://employeemanagement-lemon.vercel.app`
3. Update **Redirect URLs** (add these):
   ```
   https://employeemanagement-lemon.vercel.app
   https://employeemanagement-lemon.vercel.app/**
   http://localhost:5173
   http://localhost:5173/**
   ```
4. Click **Save**

**⏰ This takes 2 minutes but MUST be done first!**

---

## 🎯 Test Scenarios for Your Manager

### Test 1: Owner Signup (Primary Test)
```
1. Go to: https://employeemanagement-lemon.vercel.app
2. Click "Sign Up"
3. Fill in:
   - Email: manager@yourcompany.com
   - Password: TestPassword123!
   - Organization: "Your Company Name"
4. Submit
5. Check email for confirmation
6. Click confirmation link
7. Should redirect to app and auto-login
8. Check role: Should show "Owner" permissions

Expected Results:
✅ Email received with confirmation link
✅ Click redirects to employeemanagement-lemon.vercel.app (not localhost)
✅ Auto-login after confirmation
✅ Dashboard shows "Owner" in welcome message
✅ Full access to all menu items (Employees, Attendance, Leave, etc.)
✅ Organization name matches what was entered
```

### Test 2: Employee Features (After Owner Login)
```
As Owner:
1. Go to "Employees" menu
2. Click "Add Employee"
3. Add a test employee
4. Employee receives invitation email

As Employee:
1. Set password via invitation link
2. Login to portal
3. Apply for leave
4. Check attendance
5. View profile

Expected Results:
✅ Employee can only see their own data
✅ Leave application works
✅ Attendance check-in/out works
✅ Limited menu access (no admin features)
```

### Test 3: Leave Management
```
Employee Side:
1. Click "Leave" menu
2. Click "Apply Leave"
3. Select leave type, dates, reason
4. For half-day: Select Morning/Afternoon
5. Submit

Owner Side:
1. Go to "Leave" menu
2. See "Pending Approvals" section
3. See "All Leave Requests" with department filter
4. Click "Approve" → Add optional remark
5. Or "Reject" → Add reason
6. Check department-wise stats
7. Set quotas and apply to all employees

Expected Results:
✅ Employee can apply leave with proper validation
✅ Overlapping dates are blocked
✅ Half-day period selection works
✅ Owner sees all requests organized by department
✅ Approval/rejection with remarks works
✅ Real-time updates (no page refresh needed)
✅ Balances update automatically
```

---

## 🐛 Known Issues & Workarounds

### Issue: Email Redirect (MUST FIX FIRST)
**Problem**: Email confirmation redirects to localhost
**Fix**: Update Supabase redirect URLs (see Step 1 above)
**Status**: Configuration change required

### Issue: Role Assignment
**Problem**: Some users getting "User" role instead of "Owner"
**Fix**: Code deployed, should work after Supabase config update
**Status**: Fixed in latest deployment

---

## 📊 Features to Demo

### For Owners/Admins:
- ✅ Employee Management (Add, Edit, Delete, Invite)
- ✅ Attendance Tracking (Mark attendance, view reports)
- ✅ Leave Management (Approve/Reject with remarks, Dept stats)
- ✅ Payroll Processing
- ✅ Performance Reviews
- ✅ Reports & Analytics
- ✅ Task Management
- ✅ Expense Claims

### For Employees:
- ✅ Self-service check-in/out
- ✅ Apply for leave (with validations)
- ✅ View leave balances
- ✅ Cancel pending requests
- ✅ View profile
- ✅ Track tasks

---

## 🔍 Troubleshooting

### "Page Not Found" After Email Confirmation
**Cause**: Supabase redirect URLs not configured
**Solution**: Follow Step 1 above

### User Has Wrong Role
**Cause**: Old signup attempt before fixes
**Solution**: 
1. Delete user from Supabase Auth
2. Delete organization from database
3. Sign up again with new email

### Organization Name Shows "My Organization"
**Cause**: Metadata not preserved
**Solution**: Now fixed with database-backed persistence

### Console Errors
**Normal**: Some TypeScript lint warnings (don't affect functionality)
**Not Normal**: 401/403 errors (check RLS policies)

---

## 📝 Current Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| Frontend | ✅ Deployed | Vercel auto-deploy from GitHub |
| Backend | ✅ Running | Supabase project active |
| Database | ✅ Migrated | All tables created |
| Edge Functions | ✅ Deployed | create-org function active |
| Auth | ⚠️ Needs Config | Redirect URLs must be updated |

---

## 🎬 Quick Start for Manager

**Option A: Quick Test (5 minutes)**
1. Update Supabase redirect URLs (Step 1 above)
2. Sign up with your email
3. Confirm via email
4. Explore dashboard

**Option B: Full Test (15 minutes)**
1. Do Option A first
2. Add a test employee
3. Login as employee (different browser/incognito)
4. Test leave application
5. Switch back to owner and approve
6. Check all menu items

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify Supabase redirect URLs are configured
3. Try incognito mode (clears cache)
4. Use latest Chrome/Edge browser

---

## ✅ Pre-Flight Checklist

Before sharing with manager:
- [ ] Supabase redirect URLs updated
- [ ] Test signup with YOUR email first
- [ ] Verify owner role is assigned
- [ ] Test email confirmation flow
- [ ] Check console for errors
- [ ] Prepare demo account credentials

---

**Last Updated**: November 13, 2025
**Deployment**: Commit `dd99880`
**Status**: Ready for testing after Supabase config update
