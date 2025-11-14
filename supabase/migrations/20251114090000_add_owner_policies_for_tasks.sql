/*
  Add owner role to task-related RLS policies so owners can create/manage tasks
  and view related time logs and GitHub stats across their organization.
*/

-- Owners can manage all tasks (select/insert/update/delete)
CREATE POLICY IF NOT EXISTS "Owners can manage all tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = tasks.organization_id
      AND om.role IN ('owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = tasks.organization_id
      AND om.role IN ('owner')
    )
  );

-- Owners can view all time logs in their organization
CREATE POLICY IF NOT EXISTS "Owners can view all time logs"
  ON task_time_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE t.id = task_time_logs.task_id
      AND om.role IN ('owner')
      AND om.user_id = auth.uid()
    )
  );

-- Owners can view all github stats in their organization
CREATE POLICY IF NOT EXISTS "Owners can view all github stats"
  ON github_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = github_stats.employee_id
      AND om.role IN ('owner')
      AND om.user_id = auth.uid()
    )
  );

-- Owners can manage github stats
CREATE POLICY IF NOT EXISTS "Owners can manage github stats"
  ON github_stats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = github_stats.employee_id
      AND om.role IN ('owner')
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = github_stats.employee_id
      AND om.role IN ('owner')
      AND om.user_id = auth.uid()
    )
  );
