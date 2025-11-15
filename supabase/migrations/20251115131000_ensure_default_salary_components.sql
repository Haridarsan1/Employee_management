-- Ensure default salary components exist for all organizations
-- This is a safety migration to populate components if the previous migration failed

DO $$
DECLARE
    v_org record;
BEGIN
    -- Loop through all organizations
    FOR v_org IN SELECT id FROM organizations LOOP
        -- Check if organization already has components
        IF NOT EXISTS (SELECT 1 FROM salary_components WHERE organization_id = v_org.id LIMIT 1) THEN
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
            
            RAISE NOTICE 'Created default salary components for organization %', v_org.id;
        END IF;
    END LOOP;
END $$;
