/*
  # Add Offer Letters Table

  ## New Table
  - offer_letters: Store employee offer letters with PDF generation capability
  
  ## Fields
  - id, employee_id, designation, department
  - joining_date, offer_date, valid_until
  - ctc_annual, salary_breakdown (JSONB for component details)
  - terms_and_conditions, pdf_url
  - status (draft, sent, accepted, rejected)
  - created_by, approved_by
*/

CREATE TABLE IF NOT EXISTS offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT,
  
  designation_id UUID REFERENCES designations(id),
  department_id UUID REFERENCES departments(id),
  branch_id UUID REFERENCES branches(id),
  
  joining_date DATE NOT NULL,
  offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  ctc_annual NUMERIC(12, 2) NOT NULL,
  salary_breakdown JSONB NOT NULL,
  
  employment_type employment_type DEFAULT 'full_time',
  probation_period_months INTEGER DEFAULT 3,
  
  terms_and_conditions TEXT,
  additional_notes TEXT,
  
  pdf_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'withdrawn')),
  
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE offer_letters ENABLE ROW LEVEL SECURITY;

-- Add policy
CREATE POLICY "Allow authenticated access" 
  ON offer_letters FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_offer_letters_org 
  ON offer_letters(organization_id);
  
CREATE INDEX IF NOT EXISTS idx_offer_letters_employee 
  ON offer_letters(employee_id);
