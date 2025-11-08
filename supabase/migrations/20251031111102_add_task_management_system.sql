/*
  # Task Management System with GitHub Integration

  ## Overview
  Complete task management system allowing admins to create and assign tasks to employees,
  track progress, and integrate with GitHub for commit statistics.

  ## New Tables

  ### 1. `tasks`
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `title` (text) - Task title
  - `description` (text) - Detailed description
  - `task_type` (text) - bug, feature, enhancement, documentation, etc.
  - `priority` (text) - low, medium, high, critical
  - `status` (text) - todo, in_progress, in_review, completed, cancelled
  - `assigned_to` (uuid, foreign key to employees)
  - `created_by` (uuid, foreign key to users)
  - `due_date` (date)
  - `estimated_hours` (numeric)
  - `actual_hours` (numeric)
  - `github_repo` (text) - GitHub repository URL
  - `github_issue_number` (integer) - GitHub issue number
  - `github_pr_number` (integer) - GitHub PR number
  - `tags` (text[]) - Array of tags
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `completed_at` (timestamptz)

  ### 2. `task_comments`
  - `id` (uuid, primary key)
  - `task_id` (uuid, foreign key)
  - `user_id` (uuid, foreign key)
  - `comment` (text)
  - `created_at` (timestamptz)

  ### 3. `task_attachments`
  - `id` (uuid, primary key)
  - `task_id` (uuid, foreign key)
  - `file_name` (text)
  - `file_url` (text)
  - `file_type` (text)
  - `uploaded_by` (uuid, foreign key to users)
  - `created_at` (timestamptz)

  ### 4. `task_time_logs`
  - `id` (uuid, primary key)
  - `task_id` (uuid, foreign key)
  - `employee_id` (uuid, foreign key)
  - `hours_logged` (numeric)
  - `log_date` (date)
  - `description` (text)
  - `created_at` (timestamptz)

  ### 5. `github_stats`
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key)
  - `github_username` (text)
  - `repository` (text)
  - `commits_count` (integer)
  - `pull_requests_count` (integer)
  - `issues_count` (integer)
  - `lines_added` (integer)
  - `lines_removed` (integer)
  - `last_commit_date` (timestamptz)
  - `last_synced_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Admins can manage all tasks
  - Employees can view and update their assigned tasks
  - All users can view task comments
  - Only task assignees can log time
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  task_type text DEFAULT 'feature' CHECK (task_type IN ('bug', 'feature', 'enhancement', 'documentation', 'research', 'maintenance')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed', 'cancelled')),
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  due_date date,
  estimated_hours numeric DEFAULT 0,
  actual_hours numeric DEFAULT 0,
  github_repo text,
  github_issue_number integer,
  github_pr_number integer,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create task_time_logs table
CREATE TABLE IF NOT EXISTS task_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  hours_logged numeric NOT NULL,
  log_date date DEFAULT CURRENT_DATE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create github_stats table
CREATE TABLE IF NOT EXISTS github_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  github_username text NOT NULL,
  repository text,
  commits_count integer DEFAULT 0,
  pull_requests_count integer DEFAULT 0,
  issues_count integer DEFAULT 0,
  lines_added integer DEFAULT 0,
  lines_removed integer DEFAULT 0,
  last_commit_date timestamptz,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, repository)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_employee ON task_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_github_stats_employee ON github_stats(employee_id);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Admins can manage all tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = tasks.organization_id
      AND om.role IN ('admin', 'hr', 'manager')
    )
  );

CREATE POLICY "Employees can view their assigned tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = tasks.assigned_to
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update their assigned tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = tasks.assigned_to
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = tasks.assigned_to
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments on accessible tasks"
  ON task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_comments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments on accessible tasks"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_comments.task_id
      AND om.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- RLS Policies for task_attachments
CREATE POLICY "Users can view attachments on accessible tasks"
  ON task_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_attachments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload attachments to accessible tasks"
  ON task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_attachments.task_id
      AND om.user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

-- RLS Policies for task_time_logs
CREATE POLICY "Admins can view all time logs"
  ON task_time_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_time_logs.task_id
      AND om.role IN ('admin', 'hr', 'manager')
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view their time logs"
  ON task_time_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = task_time_logs.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can create time logs for their tasks"
  ON task_time_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = task_time_logs.employee_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policies for github_stats
CREATE POLICY "Admins can view all github stats"
  ON github_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = github_stats.employee_id
      AND om.role IN ('admin', 'hr', 'manager')
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view their github stats"
  ON github_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = github_stats.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage github stats"
  ON github_stats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = github_stats.employee_id
      AND om.role IN ('admin', 'hr')
      AND om.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tasks
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_updated_at();

-- Create function to set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for completed_at
DROP TRIGGER IF EXISTS set_tasks_completed_at ON tasks;
CREATE TRIGGER set_tasks_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_completed_at();
