-- Enhance payroll system with comprehensive features
-- Adds organization scoping, better RLS, and helper functions

-- Add organization_id to salary_components if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'salary_components' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE salary_components 
        ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_salary_components_org 
        ON salary_components(organization_id);
    END IF;
END $$;

-- Add organization_id to payroll_cycles if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payroll_cycles' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE payroll_cycles 
        ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_payroll_cycles_org 
        ON payroll_cycles(organization_id);
        
        -- Update unique constraint to include organization
        ALTER TABLE payroll_cycles DROP CONSTRAINT IF EXISTS payroll_cycles_month_year_key;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_cycles_org_month_year 
        ON payroll_cycles(organization_id, month, year);
    END IF;
END $$;

-- Add payment fields to payslips
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payslips' 
        AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE payslips 
        ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'processing')),
        ADD COLUMN payment_date timestamptz,
        ADD COLUMN payment_method text,
        ADD COLUMN payment_reference text;
    END IF;
END $$;

-- RPC: Generate payroll for a month
CREATE OR REPLACE FUNCTION public.generate_payroll_for_month(
    p_organization_id uuid,
    p_month integer,
    p_year integer,
    p_from_date date,
    p_to_date date,
    p_employee_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cycle_id uuid;
    v_employee record;
    v_payslip_count integer := 0;
    v_total_gross numeric := 0;
    v_total_deductions numeric := 0;
    v_total_net numeric := 0;
    v_working_days integer;
    v_present_days numeric;
    v_basic numeric;
    v_hra numeric;
    v_other_earnings numeric;
    v_gross numeric;
    v_pf numeric;
    v_tax numeric;
    v_other_deductions numeric;
    v_total_ded numeric;
    v_net numeric;
    v_earnings jsonb;
    v_deductions jsonb;
BEGIN
    -- Calculate working days
    v_working_days := (p_to_date - p_from_date + 1);
    
    -- Check if cycle already exists
    SELECT id INTO v_cycle_id FROM payroll_cycles 
    WHERE organization_id = p_organization_id 
    AND month = p_month 
    AND year = p_year;
    
    IF v_cycle_id IS NULL THEN
        -- Create new payroll cycle
        INSERT INTO payroll_cycles (
            organization_id, month, year, from_date, to_date, 
            status, total_employees, total_gross_salary, total_deductions, total_net_salary
        ) VALUES (
            p_organization_id, p_month, p_year, p_from_date, p_to_date,
            'draft', 0, 0, 0, 0
        ) RETURNING id INTO v_cycle_id;
    ELSE
        -- Update existing cycle
        UPDATE payroll_cycles 
        SET from_date = p_from_date, to_date = p_to_date, status = 'draft'
        WHERE id = v_cycle_id;
        
        -- Delete existing payslips for regeneration
        DELETE FROM payslips WHERE payroll_cycle_id = v_cycle_id;
    END IF;
    
    -- Loop through employees
    FOR v_employee IN 
        SELECT e.id, e.basic_salary, e.ctc_annual
        FROM employees e
        WHERE e.organization_id = p_organization_id
        AND e.employment_status = 'active'
        AND (p_employee_ids IS NULL OR e.id = ANY(p_employee_ids))
    LOOP
        -- Calculate present days (simplified - you can enhance with attendance)
        v_present_days := v_working_days;
        
        -- Basic salary calculation
        v_basic := COALESCE(v_employee.basic_salary, 0);
        v_hra := v_basic * 0.4;
        v_other_earnings := v_basic * 0.2; -- Conveyance, allowances, etc.
        v_gross := v_basic + v_hra + v_other_earnings;
        
        -- Deductions
        v_pf := v_basic * 0.12;
        v_tax := CASE 
            WHEN v_gross * 12 > 1000000 THEN v_gross * 0.15
            WHEN v_gross * 12 > 500000 THEN v_gross * 0.10
            ELSE 0
        END;
        v_other_deductions := 200; -- Professional tax, etc.
        v_total_ded := v_pf + v_tax + v_other_deductions;
        
        -- Net salary
        v_net := v_gross - v_total_ded;
        
        -- Build earnings JSON
        v_earnings := jsonb_build_object(
            'basic', v_basic,
            'hra', v_hra,
            'other_allowances', v_other_earnings
        );
        
        -- Build deductions JSON
        v_deductions := jsonb_build_object(
            'pf', v_pf,
            'income_tax', v_tax,
            'other', v_other_deductions
        );
        
        -- Create payslip
        INSERT INTO payslips (
            payroll_cycle_id, employee_id,
            working_days, present_days, leave_days, lop_days, paid_days,
            gross_salary, total_earnings, total_deductions, net_salary,
            earnings, deductions, payment_status
        ) VALUES (
            v_cycle_id, v_employee.id,
            v_working_days, v_present_days, 0, 0, v_present_days,
            v_gross, v_gross, v_total_ded, v_net,
            v_earnings, v_deductions, 'unpaid'
        );
        
        v_payslip_count := v_payslip_count + 1;
        v_total_gross := v_total_gross + v_gross;
        v_total_deductions := v_total_deductions + v_total_ded;
        v_total_net := v_total_net + v_net;
    END LOOP;
    
    -- Update payroll cycle totals
    UPDATE payroll_cycles 
    SET total_employees = v_payslip_count,
        total_gross_salary = v_total_gross,
        total_deductions = v_total_deductions,
        total_net_salary = v_total_net,
        status = 'processed',
        processed_at = now()
    WHERE id = v_cycle_id;
    
    RETURN jsonb_build_object(
        'cycle_id', v_cycle_id,
        'payslips_generated', v_payslip_count,
        'total_gross', v_total_gross,
        'total_net', v_total_net
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_payroll_for_month TO authenticated;

-- RPC: Mark payslips as paid
CREATE OR REPLACE FUNCTION public.mark_payslips_paid(
    p_payslip_ids uuid[],
    p_payment_method text DEFAULT 'bank_transfer',
    p_payment_reference text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE payslips
    SET payment_status = 'paid',
        payment_date = now(),
        payment_method = p_payment_method,
        payment_reference = p_payment_reference
    WHERE id = ANY(p_payslip_ids)
    AND payment_status = 'unpaid';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payslips_paid TO authenticated;

-- Update RLS policies for payroll_cycles
DROP POLICY IF EXISTS "Employees can view own payroll cycles" ON payroll_cycles;
DROP POLICY IF EXISTS "Organization members can view payroll cycles" ON payroll_cycles;
DROP POLICY IF EXISTS "Organization admins can manage payroll cycles" ON payroll_cycles;

CREATE POLICY "Organization members can view payroll cycles"
ON payroll_cycles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = payroll_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

CREATE POLICY "Organization admins can manage payroll cycles"
ON payroll_cycles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = payroll_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = payroll_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
);

-- Update RLS policies for payslips
DROP POLICY IF EXISTS "Employees can view own payslips" ON payslips;
DROP POLICY IF EXISTS "Organization admins can manage payslips" ON payslips;

CREATE POLICY "Employees can view own payslips"
ON payslips FOR SELECT
TO authenticated
USING (
    employee_id IN (
        SELECT e.id FROM employees e
        INNER JOIN organization_members om ON om.employee_id = e.id
        WHERE om.user_id = auth.uid()
        AND om.is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM organization_members om
        INNER JOIN employees e ON e.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
        AND e.id = payslips.employee_id
    )
);

CREATE POLICY "Organization admins can manage payslips"
ON payslips FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM employees e
        INNER JOIN organization_members om ON om.organization_id = e.organization_id
        WHERE e.id = payslips.employee_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM employees e
        INNER JOIN organization_members om ON om.organization_id = e.organization_id
        WHERE e.id = payslips.employee_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
);

-- Update RLS policies for salary_components
DROP POLICY IF EXISTS "Allow authenticated access" ON salary_components;

CREATE POLICY "Organization members can view salary components"
ON salary_components FOR SELECT
TO authenticated
USING (
    organization_id IS NULL -- Global components
    OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = salary_components.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

CREATE POLICY "Organization admins can manage salary components"
ON salary_components FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = salary_components.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = salary_components.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'hr')
        AND om.is_active = true
    )
);

-- Add default salary components for organizations that don't have any
DO $$
DECLARE
    v_org record;
BEGIN
    FOR v_org IN SELECT id FROM organizations LOOP
        -- Check if organization already has components
        IF NOT EXISTS (SELECT 1 FROM salary_components WHERE organization_id = v_org.id) THEN
            -- Add default earning components
            INSERT INTO salary_components (organization_id, name, code, type, is_taxable, is_active, display_order)
            VALUES 
                (v_org.id, 'Basic Salary', 'BASIC', 'earning', true, true, 1),
                (v_org.id, 'HRA', 'HRA', 'earning', true, true, 2),
                (v_org.id, 'Conveyance Allowance', 'CONV', 'earning', false, true, 3),
                (v_org.id, 'Medical Allowance', 'MED', 'earning', false, true, 4),
                (v_org.id, 'LTA', 'LTA', 'earning', false, true, 5),
                (v_org.id, 'Provident Fund', 'PF', 'deduction', false, true, 1),
                (v_org.id, 'Income Tax', 'TAX', 'deduction', false, true, 2),
                (v_org.id, 'Professional Tax', 'PTAX', 'deduction', false, true, 3)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;
