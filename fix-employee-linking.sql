-- Function to link employee account to user after registration
-- This ensures employees are automatically connected to their organization

CREATE OR REPLACE FUNCTION link_employee_to_user(
  invitation_code_param TEXT,
  user_id_param UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
  v_organization_id UUID;
  v_invitation_id UUID;
BEGIN
  -- Get the invitation details
  SELECT 
    id,
    employee_id,
    organization_id
  INTO 
    v_invitation_id,
    v_employee_id,
    v_organization_id
  FROM employee_invitations
  WHERE invitation_code = invitation_code_param
    AND status = 'pending'
    AND expires_at > NOW();

  -- Check if invitation exists
  IF v_employee_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invitation code'
    );
  END IF;

  -- Update the employee record with the user_id
  UPDATE employees
  SET 
    user_id = user_id_param,
    updated_at = NOW()
  WHERE id = v_employee_id
    AND organization_id = v_organization_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Employee record not found'
    );
  END IF;

  -- Mark invitation as accepted
  UPDATE employee_invitations
  SET 
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = v_invitation_id;

  -- Create organization member entry with employee role
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    is_active
  )
  VALUES (
    v_organization_id,
    user_id_param,
    'employee',
    true
  )
  ON CONFLICT (organization_id, user_id) 
  DO UPDATE SET 
    is_active = true,
    updated_at = NOW();

  -- Update user profile with current organization
  INSERT INTO user_profiles (
    user_id,
    current_organization_id,
    created_at,
    updated_at
  )
  VALUES (
    user_id_param,
    v_organization_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_organization_id = v_organization_id,
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'employee_id', v_employee_id,
    'organization_id', v_organization_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION link_employee_to_user(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION link_employee_to_user(TEXT, UUID) TO anon;

COMMENT ON FUNCTION link_employee_to_user IS 'Links an employee record to a user account after registration via invitation';
