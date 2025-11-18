# GitHub Integration - Quick Setup Checklist

## ✅ Database Setup

### 1. Apply Notifications Migration (if not done already)
- [ ] Navigate to: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/sql/new
- [ ] Open `NOTIFICATIONS_MIGRATION_MANUAL.sql` from project root
- [ ] Copy all content and paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify: `SELECT COUNT(*) FROM notifications;` returns 0

### 2. Apply GitHub Integration Migration
- [ ] Navigate to: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/sql/new
- [ ] Open `GITHUB_INTEGRATION_MIGRATION.sql` from project root
- [ ] Copy all content and paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify all 8 tables created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'github_%'
ORDER BY table_name;
```

Expected output:
- github_activity_metrics
- github_commits
- github_employee_connections
- github_issues
- github_org_settings
- github_productivity_scores
- github_pull_requests
- github_repositories

## ✅ Frontend Verification

### 3. Build Project
- [x] Already completed - build succeeded ✓
- [x] No TypeScript errors ✓
- [x] All imports resolved ✓

### 4. Test Employee Portal Access
- [ ] Login as Employee
- [ ] Click "GitHub" in sidebar
- [ ] Verify connection form appears
- [ ] Verify "Connect GitHub" button visible

### 5. Test Owner Portal Access
- [ ] Login as Owner
- [ ] Click "GitHub" in sidebar
- [ ] Verify analytics dashboard appears
- [ ] Verify empty state shows correctly

## ✅ GitHub Token Setup

### 6. Create Personal Access Token
- [ ] Go to: https://github.com/settings/tokens
- [ ] Click "Generate new token (classic)"
- [ ] Give it a name: "EMS Integration"
- [ ] Select scopes:
  - [x] `repo` (Full control of private repositories)
  - [x] `user:read` (Read user profile data)
- [ ] Click "Generate token"
- [ ] Copy token (starts with `ghp_`)
- [ ] Save token securely

## ✅ Integration Testing

### 7. Employee Connection Test
- [ ] Login as Employee
- [ ] Navigate to GitHub page
- [ ] Click "Connect GitHub"
- [ ] Paste personal access token
- [ ] Click "Connect"
- [ ] Wait for sync to complete
- [ ] Verify success message appears
- [ ] Verify repositories loaded
- [ ] Verify commits displayed
- [ ] Verify PRs displayed
- [ ] Verify issues displayed
- [ ] Verify activity graph shows data
- [ ] Verify productivity score calculated

### 8. Owner Analytics Test
- [ ] Login as Owner
- [ ] Navigate to GitHub page
- [ ] Verify team overview stats show connected employees
- [ ] Verify total commits count
- [ ] Verify total PRs count
- [ ] Verify team activity graph displays
- [ ] Verify top contributor card appears
- [ ] Verify developer leaderboard shows employees
- [ ] Test search functionality (search by name)
- [ ] Test sort by score/commits/PRs
- [ ] Change date range (7/30/90 days)
- [ ] Verify top repositories section

### 9. Manual Sync Test
- [ ] As Employee, make a new commit on GitHub
- [ ] Wait 30 seconds
- [ ] Click "Sync Now" button in Employee GitHub page
- [ ] Verify sync in progress (spinner appears)
- [ ] Verify new commit appears after sync
- [ ] Verify metrics updated
- [ ] Verify productivity score recalculated

## ✅ Data Verification

### 10. Database Records Check
After employee connects and syncs:

```sql
-- Check connection created
SELECT * FROM github_employee_connections 
WHERE organization_id = 'YOUR_ORG_ID';

-- Check repositories synced
SELECT COUNT(*) FROM github_repositories 
WHERE organization_id = 'YOUR_ORG_ID';

-- Check commits synced
SELECT COUNT(*) FROM github_commits 
WHERE organization_id = 'YOUR_ORG_ID';

-- Check PRs synced
SELECT COUNT(*) FROM github_pull_requests 
WHERE organization_id = 'YOUR_ORG_ID';

-- Check daily metrics calculated
SELECT * FROM github_activity_metrics 
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY activity_date DESC
LIMIT 7;

-- Check productivity scores calculated
SELECT * FROM github_productivity_scores 
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY period_start DESC;
```

## ✅ Edge Cases Testing

### 11. Error Handling
- [ ] Test invalid token (should show error)
- [ ] Test expired token (should show error)
- [ ] Test sync with no repositories (should show empty state)
- [ ] Test connection while offline (should show network error)
- [ ] Test multiple employees connecting (should isolate data)

### 12. Multi-Tenancy Verification
- [ ] Connect as Employee in Org A
- [ ] Connect as Employee in Org B (different org)
- [ ] Verify Org A employee only sees their org's data
- [ ] Verify Org B employee only sees their org's data
- [ ] Verify no cross-org data leakage

## 🎯 Current Status

### Completed ✅
- [x] Database schema designed (9 tables)
- [x] GitHub API service layer (`src/lib/github.ts`)
- [x] Employee GitHub portal UI (`EmployeeGitHubPage.tsx`)
- [x] Owner analytics dashboard UI (`OwnerGitHubPage.tsx`)
- [x] App routing configured
- [x] Build successful with no errors
- [x] Manual migration files created
- [x] Setup guide documentation

### Pending ⏳
- [ ] Apply database migrations to Supabase
- [ ] Test employee connection flow
- [ ] Test owner analytics dashboard
- [ ] Verify data sync and metrics calculation
- [ ] Test multi-tenancy isolation

### Future Enhancements 🚀
- [ ] Add GitHub notifications (PR events, failed CI/CD)
- [ ] Integrate with Performance module
- [ ] Add automated background sync (every 4 hours)
- [ ] Add real-time webhooks
- [ ] Add advanced analytics (code quality, collaboration metrics)

## 📝 Notes

### Rate Limits
- GitHub API: 5,000 requests/hour (authenticated)
- Current sync limits:
  - Max 10 repositories per employee
  - Last 3 months of commits
  - All PRs and issues

### Security
- Tokens encrypted in Supabase
- RLS enforces organization isolation
- Employees cannot see other employees' tokens
- Owners see analytics but not individual tokens

### Performance
- Initial sync may take 10-30 seconds
- Manual sync takes 5-15 seconds
- Dashboard loads instantly (cached data)

## 🆘 Troubleshooting

### "Column organization_id does not exist"
- Tables not created yet
- Apply migration SQL via Supabase Dashboard

### "Invalid token" error
- Token expired or wrong scopes
- Regenerate token with `repo` + `user` scopes

### No repositories showing
- GitHub account has no repos
- Token lacks `repo` scope
- Sync failed - check browser console

### Productivity score is 0
- No activity in last 7 days
- Sync hasn't completed yet
- Run manual sync

---

**Next Step:** Apply both migration files (notifications + GitHub) via Supabase Dashboard SQL Editor, then test the complete flow!
