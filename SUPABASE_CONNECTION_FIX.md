# Supabase Connection Issues - Troubleshooting Guide

## Problem
Cannot push migrations to Supabase - network timeout when connecting to `aws-0-ap-southeast-1.pooler.supabase.com`

## Root Cause
Your network/firewall is blocking the connection to Supabase's pooler endpoint.

## Solution Options

### Option 1: Use Supabase Dashboard SQL Editor (RECOMMENDED - Quick Fix)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/sql/new

2. **Copy and paste the entire contents of:**
   - `NOTIFICATIONS_MIGRATION_MANUAL.sql` (created in this folder)

3. **Click "Run" to execute**
   - This will create the notifications system directly via the web dashboard

4. **Verify it worked:**
   ```sql
   SELECT COUNT(*) FROM notifications;
   SELECT * FROM pg_policies WHERE tablename = 'notifications';
   ```

### Option 2: Fix Network Connection

#### A. Check Firewall/Antivirus
1. Temporarily disable Windows Firewall:
   ```powershell
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   ```
2. Try `supabase db push` again
3. Re-enable firewall:
   ```powershell
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
   ```

#### B. Check VPN/Proxy
- Disable any active VPN
- Check proxy settings: `netsh winhttp show proxy`
- Try with/without VPN

#### C. Use Direct Connection URL
Instead of pooler, use direct connection:
```powershell
# In your .env or supabase config
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.idhozyvxxxnznqzhrhrs.supabase.co:5432/postgres
```

#### D. Check DNS Resolution
```powershell
# Clear DNS cache
ipconfig /flushdns

# Test resolution
nslookup aws-0-ap-southeast-1.pooler.supabase.com

# Try Google DNS
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("8.8.8.8","8.8.4.4")
```

### Option 3: Use Supabase CLI with Alternative Method

```powershell
# Link your project (if not already)
supabase link --project-ref idhozyvxxxnznqzhrhrs

# Try using the migration file directly via SQL
supabase db execute --file .\supabase\migrations\20251118091500_create_notifications_system.sql
```

## After Migration is Applied

Once the notifications table is created (via any method above), you can:

1. **Start the app:**
   ```powershell
   npm run dev
   ```

2. **Test notifications:**
   - Create an announcement (Owner portal)
   - Apply for leave (Employee portal)
   - Check the bell icon for notifications

## Current Status

- ✅ Migration file created: `20251118091500_create_notifications_system.sql`
- ✅ Manual SQL version created: `NOTIFICATIONS_MIGRATION_MANUAL.sql`
- ❌ Network connection to Supabase pooler timing out
- 🔄 **Next Step: Use Option 1 (Dashboard SQL Editor)**

## Need Help?

If none of these work:
1. Check Supabase Status: https://status.supabase.com/
2. Try from a different network (mobile hotspot)
3. Contact your network administrator about PostgreSQL port (5432) access
