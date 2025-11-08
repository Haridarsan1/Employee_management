# Supabase Database Migration Guide

## Current Configuration
- **URL**: https://fkyfoykhpwjnwgtymvii.supabase.co
- **Project Ref**: fkyfoykhpwjnwgtymvii

## Steps to Change Supabase Database

### Step 1: Create New Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Click "New Project"
4. Fill in project details:
   - Name: Your new project name
   - Database Password: Choose a strong password
   - Region: Select appropriate region
5. Wait for project creation (usually 2-3 minutes)

### Step 2: Get New Project Credentials
After project creation:
1. Go to Project Settings → API
2. Copy the following:
   - **Project URL** (anon public)
   - **anon public** key
   - **service_role** key (keep secret!)

### Step 3: Update Environment Variables
Update your `.env` file with new credentials:

```env
VITE_SUPABASE_URL=https://your-new-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key-here
```

### Step 4: Database Schema Migration
You have two options:

#### Option A: Run Migrations (Recommended)
If you want to recreate the same schema:
1. Navigate to your new Supabase project dashboard
2. Go to SQL Editor
3. Run all migration files in order from `supabase/migrations/`
4. Execute them one by one in chronological order

#### Option B: Manual Schema Creation
Use the Master Data Management in Settings to recreate:
- Departments
- Designations
- Branches
- Other master data

### Step 5: Update Authentication Settings
In your new Supabase project:
1. Go to Authentication → Settings
2. Configure:
   - Site URL: Your deployment URL (localhost for development)
   - Redirect URLs: Add your app URLs
3. Enable email confirmations if needed

### Step 6: Test Connection
1. Update the `.env` file
2. Restart your development server
3. Test basic functionality:
   - User registration/login
   - Database connections
   - CRUD operations

### Step 7: Data Migration (Optional)
If you need to migrate existing data:
1. Export data from old database
2. Transform data if needed
3. Import to new database
4. Update any foreign key relationships

### Step 8: Update Deployment
When deploying to Vercel/Netlify:
1. Update environment variables in deployment platform
2. Redeploy the application
3. Test all features in production

## Important Notes

- **Backup First**: Always backup your current database before making changes
- **Environment Variables**: Never commit `.env` files to version control
- **Service Role Key**: Keep this secret and only use in server-side code
- **RLS Policies**: Ensure Row Level Security policies are properly set up
- **Testing**: Thoroughly test all features after migration

## Quick Update Script

Would you like me to help you update the configuration with new Supabase credentials?</content>
<parameter name="filePath">c:\Users\HARIDARSAN\Downloads\EMS-Ui\project\SUPABASE_MIGRATION_GUIDE.md