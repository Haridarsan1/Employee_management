/*
  Add owner role to attendance management policies
*/

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'Owners can manage organization attendance'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can manage organization attendance" ON public.attendance_records';
  END IF;
END $$;

CREATE POLICY "Owners can manage organization attendance"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_records.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_records.employee_id
      AND is_organization_member(employees.organization_id)
      AND get_user_role_in_organization(employees.organization_id) IN ('owner')
    )
  );
