import { supabase } from './supabase';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{ filename: string; additions: number; deletions: number }>;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  base: { ref: string };
  head: { ref: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  comments?: number;
  review_comments?: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
  comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

async function githubFetch(endpoint: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub token is invalid or expired');
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded');
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  return githubFetch('/user', token);
}

export async function fetchUserRepositories(token: string, username?: string): Promise<GitHubRepo[]> {
  const endpoint = username ? `/users/${username}/repos` : '/user/repos';
  return githubFetch(`${endpoint}?per_page=100&sort=updated`, token);
}

export async function fetchRepoCommits(token: string, owner: string, repo: string, since?: string): Promise<GitHubCommit[]> {
  let endpoint = `/repos/${owner}/${repo}/commits?per_page=100`;
  if (since) endpoint += `&since=${since}`;
  return githubFetch(endpoint, token);
}

export async function fetchCommitDetails(token: string, owner: string, repo: string, sha: string): Promise<GitHubCommit> {
  return githubFetch(`/repos/${owner}/${repo}/commits/${sha}`, token);
}

export async function fetchRepoPullRequests(token: string, owner: string, repo: string, state: 'all' | 'open' | 'closed' = 'all'): Promise<GitHubPR[]> {
  return githubFetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100&sort=updated&direction=desc`, token);
}

export async function fetchPRDetails(token: string, owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
}

export async function fetchRepoIssues(token: string, owner: string, repo: string, state: 'all' | 'open' | 'closed' = 'all'): Promise<GitHubIssue[]> {
  return githubFetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100&sort=updated&direction=desc`, token);
}

export async function fetchUserIssues(token: string): Promise<GitHubIssue[]> {
  return githubFetch(`/user/issues?per_page=100&sort=updated&direction=desc`, token);
}

export async function fetchContributorStats(token: string, owner: string, repo: string): Promise<any> {
  return githubFetch(`/repos/${owner}/${repo}/stats/contributors`, token);
}

export async function syncEmployeeGitHubData(organizationId: string, employeeId: string, userId: string, token: string) {
  try {
    // Validate token and get user
    const user = await validateGitHubToken(token);

    // Update connection status
    await supabase
      .from('github_employee_connections')
      .upsert({
        organization_id: organizationId,
        employee_id: employeeId,
        user_id: userId,
        github_username: user.login,
        github_token: token,
        github_user_id: String(user.id),
        avatar_url: user.avatar_url,
        connection_status: 'connected',
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      }, { onConflict: 'organization_id,employee_id' });

    // Fetch repositories
    const repos = await fetchUserRepositories(token);
    
    // Store repositories
    for (const repo of repos) {
      await supabase.from('github_repositories').upsert({
        organization_id: organizationId,
        employee_id: employeeId,
        repo_id: String(repo.id),
        repo_name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        is_private: repo.private,
        is_fork: repo.fork,
        stars_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,employee_id,repo_id' });
    }

    // Sync commits, PRs, and issues for each repo (limit to recent activity)
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 3); // Last 3 months
    const since = sinceDate.toISOString();

    for (const repo of repos.slice(0, 10)) { // Limit to 10 repos to avoid rate limits
      try {
        const [owner, repoName] = repo.full_name.split('/');
        
        // Fetch repo record
        const { data: repoRecord } = await supabase
          .from('github_repositories')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('employee_id', employeeId)
          .eq('repo_id', String(repo.id))
          .single();

        if (!repoRecord) continue;

        // Sync commits
        const commits = await fetchRepoCommits(token, owner, repoName, since);
        for (const commit of commits) {
          const details = await fetchCommitDetails(token, owner, repoName, commit.sha);
          await supabase.from('github_commits').upsert({
            organization_id: organizationId,
            employee_id: employeeId,
            repository_id: repoRecord.id,
            commit_sha: commit.sha,
            message: commit.commit.message,
            author_name: commit.commit.author.name,
            author_email: commit.commit.author.email,
            committed_at: commit.commit.author.date,
            additions: details.stats?.additions || 0,
            deletions: details.stats?.deletions || 0,
            changed_files: details.files?.length || 0,
            html_url: commit.html_url,
          }, { onConflict: 'organization_id,employee_id,commit_sha' });
        }

        // Sync PRs
        const prs = await fetchRepoPullRequests(token, owner, repoName);
        for (const pr of prs) {
          const prDetails = await fetchPRDetails(token, owner, repoName, pr.number);
          await supabase.from('github_pull_requests').upsert({
            organization_id: organizationId,
            employee_id: employeeId,
            repository_id: repoRecord.id,
            pr_number: pr.number,
            pr_id: String(pr.id),
            title: pr.title,
            description: pr.body,
            status: pr.state === 'closed' ? (pr.merged_at ? 'merged' : 'closed') : 'open',
            is_draft: pr.draft,
            base_branch: pr.base.ref,
            head_branch: pr.head.ref,
            additions: prDetails.additions || 0,
            deletions: prDetails.deletions || 0,
            changed_files: prDetails.changed_files || 0,
            commits_count: prDetails.commits || 0,
            comments_count: prDetails.comments || 0,
            review_comments_count: prDetails.review_comments || 0,
            html_url: pr.html_url,
            created_at_github: pr.created_at,
            updated_at_github: pr.updated_at,
            merged_at: pr.merged_at,
            closed_at: pr.closed_at,
          }, { onConflict: 'organization_id,employee_id,pr_id' });
        }

        // Sync issues
        const issues = await fetchRepoIssues(token, owner, repoName);
        for (const issue of issues) {
          // Skip PRs (they appear as issues too)
          if ((issue as any).pull_request) continue;
          
          await supabase.from('github_issues').upsert({
            organization_id: organizationId,
            employee_id: employeeId,
            repository_id: repoRecord.id,
            issue_number: issue.number,
            issue_id: String(issue.id),
            title: issue.title,
            description: issue.body,
            status: issue.state === 'open' ? 'open' : 'closed',
            labels: JSON.stringify(issue.labels),
            assignees: JSON.stringify(issue.assignees),
            comments_count: issue.comments,
            html_url: issue.html_url,
            created_at_github: issue.created_at,
            updated_at_github: issue.updated_at,
            closed_at: issue.closed_at,
          }, { onConflict: 'organization_id,employee_id,issue_id' });
        }
      } catch (e) {
        console.error(`Error syncing repo ${repo.full_name}:`, e);
      }
    }

    // Calculate daily metrics
    await calculateDailyMetrics(organizationId, employeeId);

    return { success: true, user };
  } catch (error: any) {
    // Update connection with error
    await supabase
      .from('github_employee_connections')
      .update({
        connection_status: error.message.includes('invalid') ? 'invalid' : 'expired',
        sync_error: error.message,
        last_sync_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('employee_id', employeeId);

    throw error;
  }
}

async function calculateDailyMetrics(organizationId: string, employeeId: string) {
  // Aggregate metrics for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // This would ideally be a stored procedure, but for now we'll query and aggregate client-side
  const { data: commits } = await supabase
    .from('github_commits')
    .select('committed_at, additions, deletions')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .gte('committed_at', thirtyDaysAgo.toISOString());

  const { data: prs } = await supabase
    .from('github_pull_requests')
    .select('status, created_at_github, merged_at, closed_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .gte('created_at_github', thirtyDaysAgo.toISOString());

  const { data: issues } = await supabase
    .from('github_issues')
    .select('status, created_at_github, closed_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .gte('created_at_github', thirtyDaysAgo.toISOString());

  // Group by date and aggregate
  const metricsByDate: Record<string, any> = {};

  commits?.forEach(c => {
    const date = c.committed_at.split('T')[0];
    if (!metricsByDate[date]) metricsByDate[date] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
    metricsByDate[date].commits_count++;
    metricsByDate[date].additions += c.additions || 0;
    metricsByDate[date].deletions += c.deletions || 0;
  });

  prs?.forEach(pr => {
    const createDate = pr.created_at_github.split('T')[0];
    if (!metricsByDate[createDate]) metricsByDate[createDate] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
    metricsByDate[createDate].prs_opened++;

    if (pr.merged_at) {
      const mergeDate = pr.merged_at.split('T')[0];
      if (!metricsByDate[mergeDate]) metricsByDate[mergeDate] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
      metricsByDate[mergeDate].prs_merged++;
    }
    
    if (pr.closed_at && pr.status === 'closed') {
      const closeDate = pr.closed_at.split('T')[0];
      if (!metricsByDate[closeDate]) metricsByDate[closeDate] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
      metricsByDate[closeDate].prs_closed++;
    }
  });

  issues?.forEach(issue => {
    const createDate = issue.created_at_github.split('T')[0];
    if (!metricsByDate[createDate]) metricsByDate[createDate] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
    metricsByDate[createDate].issues_opened++;

    if (issue.closed_at) {
      const closeDate = issue.closed_at.split('T')[0];
      if (!metricsByDate[closeDate]) metricsByDate[closeDate] = { commits_count: 0, additions: 0, deletions: 0, prs_opened: 0, prs_merged: 0, prs_closed: 0, issues_opened: 0, issues_closed: 0 };
      metricsByDate[closeDate].issues_closed++;
    }
  });

  // Upsert metrics
  for (const [date, metrics] of Object.entries(metricsByDate)) {
    await supabase.from('github_activity_metrics').upsert({
      organization_id: organizationId,
      employee_id: employeeId,
      activity_date: date,
      ...metrics,
    }, { onConflict: 'organization_id,employee_id,activity_date' });
  }
}

export async function calculateProductivityScore(organizationId: string, employeeId: string, periodType: 'week' | 'month') {
  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);

  if (periodType === 'week') {
    periodStart.setDate(now.getDate() - 7);
  } else {
    periodStart.setMonth(now.getMonth() - 1);
  }

  const { data: metrics } = await supabase
    .from('github_activity_metrics')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .gte('activity_date', periodStart.toISOString().split('T')[0])
    .lte('activity_date', periodEnd.toISOString().split('T')[0]);

  if (!metrics || metrics.length === 0) return null;

  const totals = metrics.reduce((acc, m) => ({
    commits: acc.commits + (m.commits_count || 0),
    prs: acc.prs + (m.prs_merged || 0),
    reviews: acc.reviews + (m.code_reviews_count || 0),
    issues: acc.issues + (m.issues_closed || 0),
  }), { commits: 0, prs: 0, reviews: 0, issues: 0 });

  // Simple scoring: commits (40%), PRs (30%), reviews (20%), issues (10%)
  const commitScore = Math.min(100, (totals.commits / (periodType === 'week' ? 20 : 80)) * 100);
  const prScore = Math.min(100, (totals.prs / (periodType === 'week' ? 5 : 20)) * 100);
  const reviewScore = Math.min(100, (totals.reviews / (periodType === 'week' ? 10 : 40)) * 100);
  const issueScore = Math.min(100, (totals.issues / (periodType === 'week' ? 5 : 20)) * 100);

  const overallScore = (commitScore * 0.4) + (prScore * 0.3) + (reviewScore * 0.2) + (issueScore * 0.1);

  await supabase.from('github_productivity_scores').upsert({
    organization_id: organizationId,
    employee_id: employeeId,
    period_type: periodType,
    period_start: periodStart.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
    commit_score: commitScore,
    pr_score: prScore,
    review_score: reviewScore,
    issue_score: issueScore,
    overall_score: overallScore,
    total_commits: totals.commits,
    total_prs: totals.prs,
    total_reviews: totals.reviews,
    total_issues_closed: totals.issues,
  }, { onConflict: 'organization_id,employee_id,period_type,period_start' });

  return { overallScore, ...totals };
}
