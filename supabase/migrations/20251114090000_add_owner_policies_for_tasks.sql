/*
  Add owner role to task-related RLS policies so owners can create/manage tasks
  and view related time logs and GitHub stats across their organization.
*/

-- Drop existing policy if it exists (idempotent safety)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'Owners can manage all tasks'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can manage all tasks" ON public.tasks';
  END IF;
END $$;
CREATE POLICY "Owners can manage all tasks"
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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_time_logs' AND policyname = 'Owners can view all time logs'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can view all time logs" ON public.task_time_logs';
  END IF;
END $$;
CREATE POLICY "Owners can view all time logs"
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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'github_stats' AND policyname = 'Owners can view all github stats'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can view all github stats" ON public.github_stats';
  END IF;
END $$;
CREATE POLICY "Owners can view all github stats"
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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'github_stats' AND policyname = 'Owners can manage github stats'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can manage github stats" ON public.github_stats';
  END IF;
END $$;
CREATE POLICY "Owners can manage github stats"
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
