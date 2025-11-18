-- GitHub Integration System - Org-level isolation with employee personal connections
-- Run in Supabase SQL Editor

-- Step 1: Create enums
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'github_connection_status') THEN
    CREATE TYPE github_connection_status AS ENUM ('connected','disconnected','expired','invalid');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'github_pr_status') THEN
    CREATE TYPE github_pr_status AS ENUM ('open','closed','merged','draft');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'github_issue_status') THEN
    CREATE TYPE github_issue_status AS ENUM ('open','closed','in_progress');
  END IF;
END $$;

-- Step 2: Organization GitHub settings (org-level token)
CREATE TABLE IF NOT EXISTS github_org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  github_token text, -- encrypted org-level token (optional)
  github_org_name text, -- GitHub organization name
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_github_org_settings_org ON github_org_settings(organization_id);
ALTER TABLE github_org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_org_settings_select ON github_org_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_org_settings.organization_id 
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY github_org_settings_update ON github_org_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_org_settings.organization_id 
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

CREATE POLICY github_org_settings_insert ON github_org_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_org_settings.organization_id 
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- Step 3: Employee GitHub connections (personal tokens)
CREATE TABLE IF NOT EXISTS github_employee_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  github_username text NOT NULL,
  github_token text NOT NULL, -- encrypted personal token
  github_user_id text,
  avatar_url text,
  connection_status github_connection_status DEFAULT 'connected',
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id)
);

CREATE INDEX idx_github_employee_org ON github_employee_connections(organization_id);
CREATE INDEX idx_github_employee_emp ON github_employee_connections(employee_id);
CREATE INDEX idx_github_employee_user ON github_employee_connections(user_id);
ALTER TABLE github_employee_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_employee_connections_select ON github_employee_connections FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_employee_connections.organization_id 
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','hr','manager')
    )
  );

CREATE POLICY github_employee_connections_insert ON github_employee_connections FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_employee_connections.organization_id 
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY github_employee_connections_update ON github_employee_connections FOR UPDATE
  USING (user_id = auth.uid());

-- Step 4: GitHub repositories
CREATE TABLE IF NOT EXISTS github_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  repo_id text NOT NULL,
  repo_name text NOT NULL,
  full_name text NOT NULL,
  description text,
  language text,
  is_private boolean DEFAULT false,
  is_fork boolean DEFAULT false,
  stars_count integer DEFAULT 0,
  forks_count integer DEFAULT 0,
  open_issues_count integer DEFAULT 0,
  default_branch text DEFAULT 'main',
  html_url text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, repo_id)
);

CREATE INDEX idx_github_repos_org ON github_repositories(organization_id);
CREATE INDEX idx_github_repos_emp ON github_repositories(employee_id);
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_repos_select ON github_repositories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_repositories.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Step 5: GitHub commits
CREATE TABLE IF NOT EXISTS github_commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
  commit_sha text NOT NULL,
  message text,
  author_name text,
  author_email text,
  committed_at timestamptz NOT NULL,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  changed_files integer DEFAULT 0,
  html_url text,
  task_id uuid REFERENCES tasks(id),
  goal_id uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, commit_sha)
);

CREATE INDEX idx_github_commits_org ON github_commits(organization_id);
CREATE INDEX idx_github_commits_emp ON github_commits(employee_id);
CREATE INDEX idx_github_commits_repo ON github_commits(repository_id);
CREATE INDEX idx_github_commits_date ON github_commits(committed_at DESC);
CREATE INDEX idx_github_commits_task ON github_commits(task_id) WHERE task_id IS NOT NULL;
ALTER TABLE github_commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_commits_select ON github_commits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_commits.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Step 6: GitHub pull requests
CREATE TABLE IF NOT EXISTS github_pull_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
  pr_number integer NOT NULL,
  pr_id text NOT NULL,
  title text NOT NULL,
  description text,
  status github_pr_status DEFAULT 'open',
  is_draft boolean DEFAULT false,
  base_branch text,
  head_branch text,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  changed_files integer DEFAULT 0,
  commits_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  review_comments_count integer DEFAULT 0,
  reviews_count integer DEFAULT 0,
  html_url text,
  created_at_github timestamptz,
  updated_at_github timestamptz,
  merged_at timestamptz,
  closed_at timestamptz,
  task_id uuid REFERENCES tasks(id),
  goal_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, pr_id)
);

CREATE INDEX idx_github_prs_org ON github_pull_requests(organization_id);
CREATE INDEX idx_github_prs_emp ON github_pull_requests(employee_id);
CREATE INDEX idx_github_prs_repo ON github_pull_requests(repository_id);
CREATE INDEX idx_github_prs_status ON github_pull_requests(status);
CREATE INDEX idx_github_prs_task ON github_pull_requests(task_id) WHERE task_id IS NOT NULL;
ALTER TABLE github_pull_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_prs_select ON github_pull_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_pull_requests.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Step 7: GitHub issues
CREATE TABLE IF NOT EXISTS github_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
  issue_number integer NOT NULL,
  issue_id text NOT NULL,
  title text NOT NULL,
  description text,
  status github_issue_status DEFAULT 'open',
  labels jsonb DEFAULT '[]',
  assignees jsonb DEFAULT '[]',
  comments_count integer DEFAULT 0,
  html_url text,
  created_at_github timestamptz,
  updated_at_github timestamptz,
  closed_at timestamptz,
  task_id uuid REFERENCES tasks(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, issue_id)
);

CREATE INDEX idx_github_issues_org ON github_issues(organization_id);
CREATE INDEX idx_github_issues_emp ON github_issues(employee_id);
CREATE INDEX idx_github_issues_repo ON github_issues(repository_id);
CREATE INDEX idx_github_issues_status ON github_issues(status);
CREATE INDEX idx_github_issues_task ON github_issues(task_id) WHERE task_id IS NOT NULL;
ALTER TABLE github_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_issues_select ON github_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_issues.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Step 8: GitHub activity metrics (daily aggregates)
CREATE TABLE IF NOT EXISTS github_activity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  commits_count integer DEFAULT 0,
  prs_opened integer DEFAULT 0,
  prs_merged integer DEFAULT 0,
  prs_closed integer DEFAULT 0,
  issues_opened integer DEFAULT 0,
  issues_closed integer DEFAULT 0,
  code_reviews_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, activity_date)
);

CREATE INDEX idx_github_metrics_org ON github_activity_metrics(organization_id);
CREATE INDEX idx_github_metrics_emp ON github_activity_metrics(employee_id);
CREATE INDEX idx_github_metrics_date ON github_activity_metrics(activity_date DESC);
ALTER TABLE github_activity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_metrics_select ON github_activity_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_activity_metrics.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Step 9: GitHub productivity scores (weekly/monthly)
CREATE TABLE IF NOT EXISTS github_productivity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_type text NOT NULL, -- 'week' or 'month'
  period_start date NOT NULL,
  period_end date NOT NULL,
  commit_score numeric(5,2) DEFAULT 0,
  pr_score numeric(5,2) DEFAULT 0,
  review_score numeric(5,2) DEFAULT 0,
  issue_score numeric(5,2) DEFAULT 0,
  overall_score numeric(5,2) DEFAULT 0,
  total_commits integer DEFAULT 0,
  total_prs integer DEFAULT 0,
  total_reviews integer DEFAULT 0,
  total_issues_closed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, employee_id, period_type, period_start)
);

CREATE INDEX idx_github_scores_org ON github_productivity_scores(organization_id);
CREATE INDEX idx_github_scores_emp ON github_productivity_scores(employee_id);
CREATE INDEX idx_github_scores_period ON github_productivity_scores(period_start DESC);
ALTER TABLE github_productivity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_scores_select ON github_productivity_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = github_productivity_scores.organization_id 
      AND om.user_id = auth.uid()
    )
  );

-- Verification queries
-- SELECT COUNT(*) FROM github_employee_connections;
-- SELECT * FROM pg_policies WHERE tablename LIKE 'github%';
