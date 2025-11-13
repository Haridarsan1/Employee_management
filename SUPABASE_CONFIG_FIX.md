# URGENT: Supabase Configuration Fix

## Problem
Email confirmation redirects to `localhost:3000` instead of production URL, causing "page not found" errors.

## Solution: Update Supabase Redirect URLs

### Step 1: Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs
2. Click **Authentication** in the left sidebar
3. Click **URL Configuration**

### Step 2: Update Site URL
**Current (wrong):** `http://localhost:3000`
**Change to:** `https://employeemanagement-lemon.vercel.app`

### Step 3: Update Redirect URLs
**Add these to "Redirect URLs" list:**
```
https://employeemanagement-lemon.vercel.app
https://employeemanagement-lemon.vercel.app/**
http://localhost:5173
http://localhost:5173/**
```

### Step 4: Save Changes
Click **Save** at the bottom of the page.

### Step 5: Test Email Confirmation
1. Sign up with a NEW email
2. Check your email
3. Click confirmation link
4. Should redirect to: `https://employeemanagement-lemon.vercel.app/#access_token=...`
5. Should auto-login and create organization

---

## ⚠️ CRITICAL: Do this BEFORE sharing the app with your manager!

Without this fix, email confirmations will fail for everyone.
