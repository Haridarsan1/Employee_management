# GitHub Integration Setup Guide

## Overview
Complete GitHub integration module with organization-level separation, employee personal connections, activity tracking, productivity scoring, and owner analytics.

## Database Migration

### Step 1: Apply GitHub Schema
1. Navigate to [Supabase SQL Editor](https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/sql/new)
2. Open `GITHUB_INTEGRATION_MIGRATION.sql` from project root
3. Copy all SQL content and paste into the SQL Editor
4. Click "Run" to execute the migration
5. Verify tables created:
   - `github_org_settings`
   - `github_employee_connections`
   - `github_repositories`
   - `github_commits`
   - `github_pull_requests`
   - `github_issues`
   - `github_activity_metrics`
   - `github_productivity_scores`

### Step 2: Verify RLS Policies
Run this query to confirm all tables have proper RLS:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'github_%';
```
All tables should show `rowsecurity = true`.

## Features

### Employee Portal (`EmployeeGitHubPage`)
**Path:** Dashboard → GitHub

**Features:**
1. **Connection Setup**
   - Connect personal GitHub account with personal access token
   - Token validation and user info retrieval
   - Connection status tracking (connected, invalid, expired)

2. **Repository Management**
   - View all connected repositories
   - Repository stats (stars, forks, language, privacy)
   - Direct links to GitHub repositories

3. **Commit History**
   - Last 50 commits across all repositories
   - Commit message, repository, timestamp
   - Lines added/deleted statistics
   - Direct links to commit on GitHub

4. **Pull Requests**
   - All PRs (open, merged, closed)
   - PR status, number, title, repository
   - PR metrics (additions, deletions, reviews)
   - Direct links to PR on GitHub

5. **Issues**
   - Issues assigned to or created by employee
   - Issue status, number, title, repository
   - Comment counts
   - Direct links to issue on GitHub

6. **Activity Dashboard**
   - 30-day activity graph (commit frequency)
   - Statistics cards:
     - Total repositories
     - Total commits
     - PRs merged/total
     - Open/total issues
     - Weekly productivity score

7. **Sync Functionality**
   - Manual sync button
   - Fetches last 3 months of data
   - Syncs repos, commits, PRs, issues
   - Calculates daily metrics and productivity scores
   - Auto-updates connection status on errors

### Owner Analytics (`OwnerGitHubPage`)
**Path:** Dashboard → GitHub (Owner role only)

**Features:**
1. **Team Overview**
   - Connected developers count
   - Total team commits
   - Total/merged PRs ratio
   - Average productivity score

2. **Team Activity Trend**
   - Configurable date range (7, 30, 90 days)
   - Daily commit frequency graph
   - Hover tooltips with detailed counts

3. **Top Contributor Highlight**
   - Featured card for highest productivity score
   - Employee name, GitHub username
   - Commits, PRs, issues breakdown
   - Productivity score display

4. **Developer Leaderboard**
   - Ranked list of all connected developers
   - Search by name or GitHub username
   - Sort by:
     - Productivity score (default)
     - Total commits
     - Total PRs
   - Individual metrics display:
     - Productivity score
     - Commits count
     - PRs merged/total
     - Issues count

5. **Top Repositories**
   - Top 5 repositories by stars
   - Repository name, language, stars
   - Linked to GitHub
   - Shows repository owner (employee)

## API Service Layer (`src/lib/github.ts`)

### Core Functions

#### `validateGitHubToken(token: string)`
Validates GitHub personal access token and returns user info.
- **Returns:** `GitHubUser` object with username, avatar, etc.
- **Throws:** Error if token is invalid

#### `syncEmployeeGitHubData(orgId, employeeId, userId, token)`
Main synchronization function:
1. Validates token and retrieves GitHub user
2. Creates/updates employee connection record
3. Fetches and stores repositories (limit 10)
4. Fetches commits from last 3 months
5. Fetches pull requests
6. Fetches issues
7. Updates connection status based on success/failure

#### `calculateDailyMetrics(orgId, employeeId)`
Aggregates activity by date:
- Commits count
- Pull requests count
- Issues count
- Code reviews count
- Lines added/deleted totals

Stores results in `github_activity_metrics`.

#### `calculateProductivityScore(orgId, employeeId, periodType)`
Calculates weighted productivity score:
- **Commits:** 40% weight
- **Pull Requests:** 30% weight
- **Reviews:** 20% weight
- **Issues:** 10% weight

Stores results in `github_productivity_scores` with breakdown by category.

## Productivity Scoring Algorithm

### Formula
```
Overall Score = (Commits × 0.4) + (PRs × 0.3) + (Reviews × 0.2) + (Issues × 0.1)
```

### Scoring Breakdown
- **Commits Score:** Based on commit frequency and code changes
- **PRs Score:** Weighted by merged PRs vs total PRs
- **Reviews Score:** Based on review participation
- **Issues Score:** Based on issue resolution

### Period Types
- **Weekly:** Rolling 7-day window
- **Monthly:** Rolling 30-day window

## GitHub Token Setup

### Creating Personal Access Token
1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Required scopes:
   - `repo` (Full control of private repositories)
   - `user:read` (Read user profile data)
4. Copy the generated token (starts with `ghp_`)
5. Paste into Employee GitHub connection form

### Security Notes
- Tokens are stored encrypted in Supabase
- Each employee uses their own personal token
- Owner/admin cannot access employee tokens
- Tokens are validated on every sync
- Invalid tokens trigger connection status update

## Data Sync Strategy

### Initial Sync
When employee connects GitHub:
1. Validate token
2. Fetch up to 10 repositories
3. Fetch commits from last 3 months per repo
4. Fetch all pull requests
5. Fetch all issues assigned to user
6. Calculate daily metrics
7. Calculate productivity scores (week + month)

### Manual Sync
Employee clicks "Sync Now":
- Repeats initial sync process
- Updates existing records
- Adds new activity since last sync
- Recalculates metrics and scores

### Rate Limiting
- GitHub API: 5000 requests/hour (authenticated)
- Sync limits:
  - Max 10 repositories per employee
  - Last 3 months of commits
  - All PRs and issues (no limit)
- Handles 403 rate limit errors gracefully

## Multi-Tenancy & Security

### Organization Isolation
All tables enforce `organization_id` with RLS policies:
```sql
EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.organization_id = table.organization_id 
  AND om.user_id = auth.uid()
)
```

### Access Control
- **Employees:** Can only view/manage their own GitHub connection
- **Owners:** Can view all employee analytics but not individual tokens
- **Admins:** Same as owners

### RLS Policies
Each table has 4 policies:
1. **SELECT:** Organization members can view org data
2. **INSERT:** Organization members can insert with matching org_id
3. **UPDATE:** Organization members can update with matching org_id
4. **DELETE:** Organization members can delete with matching org_id

## Integration Points

### With Task Management
- Commits can link to `task_id`
- PRs can link to `task_id`
- Track code work per task

### With Performance Module
- Productivity scores visible in performance reviews
- GitHub metrics as performance indicators
- Code contribution tracking

### With Notifications
Ready for:
- PR opened → notify owner/team
- PR merged → notify employee
- Failed CI/CD → notify employee (critical)
- Issue assigned → notify employee

## Troubleshooting

### Connection Failed
- **Error:** "Invalid token"
  - Verify token has `repo` and `user` scopes
  - Check token hasn't expired
  - Regenerate token if needed

### No Data Synced
- **Issue:** Connection shows "connected" but no repos/commits
  - Check employee has repositories on GitHub
  - Verify repositories aren't all empty
  - Check GitHub API rate limits

### Sync Errors
- **Error:** "Rate limit exceeded"
  - Wait 1 hour for rate limit reset
  - Reduce sync frequency
  
- **Error:** "Network timeout"
  - Check internet connectivity
  - Retry sync after a few minutes

### Productivity Score is 0
- **Causes:**
  - No activity in the selected period
  - Sync hasn't run yet
  - No commits/PRs in last 7/30 days

## Future Enhancements

### Planned Features
1. **Automated Sync**
   - Background job every 4 hours
   - Real-time webhooks for instant updates

2. **Advanced Analytics**
   - Code quality metrics (test coverage, complexity)
   - Collaboration metrics (review participation)
   - Language breakdown charts
   - Contribution heatmaps

3. **Notifications**
   - PR events (opened, merged, closed, commented)
   - Failed CI/CD checks
   - Issue assignments
   - Review requests

4. **Performance Integration**
   - GitHub metrics in performance review forms
   - Automated goal tracking via commits/PRs
   - Manager visibility into code contributions

5. **Team Insights**
   - Most active repositories
   - Code review response times
   - PR merge velocity
   - Issue resolution times

## API Reference

### GitHub API Endpoints Used
- `GET /user` - Validate token, get user info
- `GET /user/repos` - Fetch user repositories
- `GET /repos/{owner}/{repo}/commits` - Fetch commits
- `GET /repos/{owner}/{repo}/commits/{sha}` - Commit details
- `GET /repos/{owner}/{repo}/pulls` - Fetch pull requests
- `GET /repos/{owner}/{repo}/pulls/{number}` - PR details
- `GET /repos/{owner}/{repo}/issues` - Fetch issues
- `GET /user/issues` - User's assigned issues

### Supabase Tables
- `github_org_settings` - Organization-level GitHub settings
- `github_employee_connections` - Employee personal tokens
- `github_repositories` - Repository metadata
- `github_commits` - Commit history
- `github_pull_requests` - PR tracking
- `github_issues` - Issue tracking
- `github_activity_metrics` - Daily aggregated metrics
- `github_productivity_scores` - Calculated productivity scores

## Support

For issues or questions:
1. Check Supabase logs for database errors
2. Check browser console for API errors
3. Verify RLS policies are active
4. Test GitHub token validity manually
5. Review network requests for API failures
