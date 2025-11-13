# Deployment Guide - Signup Fix

## Issues Fixed

### 1. **Duplicate Slug Error**
- **Problem**: Organization creation was failing with "duplicate key value violates unique constraint 'organizations_slug_key'"
- **Root Cause**: Simple slug generation without timestamp was creating duplicates when users used similar organization names
- **Solution**: Updated slug generation to include timestamp and random string for guaranteed uniqueness:
  ```
  baseSlug-timestamp-randomStr
  ```

### 2. **New Users Getting 'User' Role Instead of 'Owner'**
- **Problem**: Signup users were being assigned 'admin' role instead of 'owner'
- **Root Cause**: Both edge function and fallback were creating membership with 'admin' role
- **Solution**: Changed role assignment to 'owner' in both:
  - Edge function: `supabase/functions/create-org/index.ts`
  - Fallback logic: `src/contexts/AuthContext.tsx`

### 3. **CORS Error**
- **Problem**: Edge function was blocked by CORS when accessing from Vercel production domain
- **Root Cause**: CORS headers only allowed localhost
- **Solution**: Updated CORS headers to explicitly allow:
  - `http://localhost:5173` (development)
  - `https://employeemanagement-lemon.vercel.app` (production)

### 4. **Refresh Token Error**
- **Problem**: Console showing "Invalid Refresh Token" on first load
- **Root Cause**: Expected behavior during signup flow; not a blocking issue
- **Status**: Informational warning, does not affect functionality

## Files Changed

1. **src/contexts/AuthContext.tsx**
   - Updated slug generation with timestamp: `baseSlug-${Date.now().toString(36)}-${randomStr}`
   - Changed membership role from 'admin' to 'owner' for signup users
   - Improved logging for debugging

2. **supabase/functions/create-org/index.ts**
   - Fixed import for Deno: `jsr:@supabase/supabase-js@2`
   - Updated CORS headers to allow production Vercel domain
   - Changed membership role to 'owner'
   - Added unique slug generation with timestamp

3. **src/pages/Leave/LeavePage.tsx**
   - Added overlap prevention
   - Half-day period selection (Morning/Afternoon)
   - Accurate balance tracking
   - Realtime updates
   - Owner-side: org-wide view, dept filters, approve with remarks, quotas

## Deployment Steps

### 1. Edge Function (Already Deployed ✓)
```powershell
supabase functions deploy create-org
```
Status: **Deployed successfully** to project idhozyvxxxnznqzhrhrs

### 2. Frontend Build (Already Built ✓)
```powershell
npm run build
```
Status: **Build completed** - dist folder ready

### 3. Deploy to Vercel
Push to GitHub and Vercel will auto-deploy, OR manually:
```powershell
# If you have Vercel CLI
vercel --prod

# Or commit and push
git add .
git commit -m "Fix: Signup role, unique slugs, CORS for production"
git push origin main
```

## Testing Checklist

### New User Signup Test
1. **Go to signup page** on production
2. **Enter new email** (not used before)
3. **Enter organization name** (e.g., "Marvel")
4. **Complete signup**

**Expected Results:**
- ✅ Organization created successfully
- ✅ User assigned **'owner'** role (not 'user' or 'admin')
- ✅ No duplicate slug errors
- ✅ No CORS errors in console
- ✅ User redirected to dashboard with full owner permissions

### Leave Management Test (Employee)
1. **Apply leave** with half-day option
2. **Select period** (Morning/Afternoon)
3. **Try overlapping dates** → Should be blocked
4. **Check balance** → Should update accurately
5. **Cancel pending** → Balance restored

### Leave Management Test (Owner)
1. **View "All Leave Requests"** section
2. **Filter by department** → Stats update
3. **Approve with remark** → Remark saved
4. **Reject with reason** → Reason saved
5. **Set quotas** → Apply to all employees
6. **Check realtime updates** → Lists refresh automatically

## Console Warnings (Non-blocking)

These warnings are expected and don't affect functionality:

1. **"Failed to load resource: vite.svg:1 (404)"**
   - Missing favicon reference
   - Does not affect app functionality

2. **"Invalid Refresh Token" on first load**
   - Expected during initial auth setup
   - Resolves after successful login

3. **TypeScript errors in other files**
   - Pre-existing unused imports
   - Do not block production build

## Verification Commands

```powershell
# Check auth context has no errors
npm run typecheck 2>&1 | Select-String "AuthContext"

# Verify edge function is deployed
supabase functions list

# Check current build
ls dist
```

## Rollback Plan (if needed)

If issues occur, revert to previous commit:
```powershell
git log --oneline -5
git revert HEAD
git push origin main
```

## Next Steps After Deployment

1. **Test signup flow** with a new email address
2. **Verify owner role** is assigned correctly
3. **Test leave management** features
4. **Monitor console** for any new errors
5. **Check Supabase logs** for edge function calls

---

**Status**: Ready for production deployment ✓
**Build**: Successful (dist/index-CVAjsz9E.js)
**Edge Function**: Deployed to Supabase
**Migration**: Applied (remarks column)
