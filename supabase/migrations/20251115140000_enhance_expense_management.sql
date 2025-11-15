/*
  # Enhance Expense Management System
  
  1. Add organization_id to expense_claims for multi-tenancy
  2. Add approval workflow fields (approver remarks, attachments)
  3. Add RPC functions for approval/rejection workflow
  4. Enhance RLS policies for proper access control
  5. Add indexes for performance
*/

-- Add organization_id to expense_claims if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_claims' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE expense_claims 
    ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Populate organization_id from employee relationship
    UPDATE expense_claims ec
    SET organization_id = e.organization_id
    FROM employees e
    WHERE ec.employee_id = e.id
    AND ec.organization_id IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE expense_claims ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- Add approver remarks and attachments fields
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_claims' 
    AND column_name = 'approver_remarks'
  ) THEN
    ALTER TABLE expense_claims ADD COLUMN approver_remarks text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_claims' 
    AND column_name = 'attachments'
  ) THEN
    ALTER TABLE expense_claims ADD COLUMN attachments jsonb DEFAULT '[]';
  END IF;
END $$;

-- Add claim counter for generating claim numbers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' 
    AND column_name = 'expense_claim_counter'
  ) THEN
    ALTER TABLE organizations ADD COLUMN expense_claim_counter integer DEFAULT 0;
  END IF;
END $$;

-- Function to generate expense claim number
CREATE OR REPLACE FUNCTION generate_expense_claim_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter integer;
  v_claim_number text;
BEGIN
  -- Increment counter
  UPDATE organizations
  SET expense_claim_counter = COALESCE(expense_claim_counter, 0) + 1
  WHERE id = p_organization_id
  RETURNING expense_claim_counter INTO v_counter;
  
  -- Generate claim number: EXP-YYYYMM-NNNN
  v_claim_number := 'EXP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_counter::text, 4, '0');
  
  RETURN v_claim_number;
END;
$$;

-- Function to approve expense claims
CREATE OR REPLACE FUNCTION approve_expense_claims(
  p_claim_ids uuid[],
  p_approver_id uuid,
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approved_count integer := 0;
  v_claim_id uuid;
  v_employee_id uuid;
BEGIN
  -- Verify approver has permission (must be owner/admin/hr)
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'hr', 'finance')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve expense claims';
  END IF;
  
  -- Approve each claim
  FOREACH v_claim_id IN ARRAY p_claim_ids
  LOOP
    UPDATE expense_claims
    SET 
      status = 'approved',
      approved_by = p_approver_id,
      approved_at = NOW(),
      approver_remarks = p_remarks
    WHERE id = v_claim_id
    AND status = 'submitted'
    RETURNING employee_id INTO v_employee_id;
    
    IF FOUND THEN
      v_approved_count := v_approved_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'message', v_approved_count || ' expense claim(s) approved successfully'
  );
END;
$$;

-- Function to reject expense claims
CREATE OR REPLACE FUNCTION reject_expense_claims(
  p_claim_ids uuid[],
  p_approver_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rejected_count integer := 0;
  v_claim_id uuid;
BEGIN
  -- Verify approver has permission
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'hr', 'finance')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject expense claims';
  END IF;
  
  -- Validate rejection reason
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Reject each claim
  FOREACH v_claim_id IN ARRAY p_claim_ids
  LOOP
    UPDATE expense_claims
    SET 
      status = 'rejected',
      approved_by = p_approver_id,
      approved_at = NOW(),
      rejection_reason = p_reason,
      approver_remarks = p_reason
    WHERE id = v_claim_id
    AND status = 'submitted';
    
    IF FOUND THEN
      v_rejected_count := v_rejected_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'rejected_count', v_rejected_count,
    'message', v_rejected_count || ' expense claim(s) rejected'
  );
END;
$$;

-- Function to submit expense claim (change status from draft to submitted)
CREATE OR REPLACE FUNCTION submit_expense_claim(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id uuid;
  v_total_amount numeric;
BEGIN
  -- Get claim details
  SELECT employee_id, total_amount
  INTO v_employee_id, v_total_amount
  FROM expense_claims
  WHERE id = p_claim_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense claim not found';
  END IF;
  
  -- Verify user owns this claim
  IF NOT EXISTS (
    SELECT 1 FROM employees e
    JOIN organization_members om ON e.id = om.employee_id
    WHERE e.id = v_employee_id
    AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only submit your own expense claims';
  END IF;
  
  -- Validate claim has items
  IF NOT EXISTS (
    SELECT 1 FROM expense_items
    WHERE claim_id = p_claim_id
  ) THEN
    RAISE EXCEPTION 'Cannot submit empty expense claim. Please add at least one expense item.';
  END IF;
  
  -- Update status to submitted
  UPDATE expense_claims
  SET 
    status = 'submitted',
    submitted_at = NOW()
  WHERE id = p_claim_id
  AND status = 'draft';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense claim cannot be submitted. It may already be submitted or in another state.';
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Expense claim submitted successfully',
    'claim_id', p_claim_id
  );
END;
$$;

-- Drop existing RLS policies on expense_claims
DROP POLICY IF EXISTS "Employees can manage their own expense claims" ON expense_claims;
DROP POLICY IF EXISTS "Managers can view all expense claims" ON expense_claims;

-- Create comprehensive RLS policies for expense_claims
CREATE POLICY "Employees can view their own expense claims"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = expense_claims.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can insert their own expense claims"
  ON expense_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = expense_claims.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update their own draft expense claims"
  ON expense_claims FOR UPDATE
  TO authenticated
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = expense_claims.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all expense claims in organization"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = expense_claims.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr', 'finance')
    )
  );

CREATE POLICY "Admins can update expense claims in organization"
  ON expense_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = expense_claims.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr', 'finance')
    )
  );

-- RLS policies for expense_items
CREATE POLICY "Users can manage expense items for their claims"
  ON expense_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_claims ec
      JOIN employees e ON ec.employee_id = e.id
      JOIN organization_members om ON e.id = om.employee_id
      WHERE ec.id = expense_items.claim_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all expense items in organization"
  ON expense_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_claims ec
      JOIN organization_members om ON ec.organization_id = om.organization_id
      WHERE ec.id = expense_items.claim_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr', 'finance')
    )
  );

-- RLS policies for expense_categories
CREATE POLICY "Organization members can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = expense_categories.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage expense categories"
  ON expense_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = expense_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'finance')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expense_claims_org_status ON expense_claims(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_employee_status ON expense_claims(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_submitted_at ON expense_claims(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_items_claim ON expense_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_org ON expense_categories(organization_id, is_active);
