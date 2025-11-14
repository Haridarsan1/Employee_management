-- Fix Helpdesk Migration
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if needed and recreate with proper structure
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS ticket_activities CASCADE;
DROP TABLE IF EXISTS kb_articles CASCADE;
DROP TABLE IF EXISTS sla_policies CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;

-- Create ticket status enum
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'reopened');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create ticket priority enum
DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create ticket category enum
DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM ('technical', 'hr', 'admin', 'payroll', 'leave', 'attendance', 'access', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Support Tickets Table
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ticket_number text UNIQUE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  category ticket_category NOT NULL,
  priority ticket_priority DEFAULT 'medium',
  subject text NOT NULL,
  description text NOT NULL,
  status ticket_status DEFAULT 'open',
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  sla_due_date timestamptz,
  is_overdue boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket Comments Table
CREATE TABLE ticket_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Ticket Attachments Table
CREATE TABLE ticket_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  created_at timestamptz DEFAULT now()
);

-- Ticket Activities Table
CREATE TABLE ticket_activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  old_value text,
  new_value text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Knowledge Base Articles Table
CREATE TABLE kb_articles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  views integer DEFAULT 0
);

-- SLA Policies Table
CREATE TABLE sla_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  priority ticket_priority NOT NULL,
  response_time_hours integer NOT NULL,
  resolution_time_hours integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, priority)
);

-- Create indexes
CREATE INDEX idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX idx_support_tickets_employee ON support_tickets(employee_id);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX idx_kb_articles_org ON kb_articles(organization_id);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 4) AS integer)), 0) + 1
  INTO counter
  FROM support_tickets
  WHERE ticket_number LIKE 'TKT%';
  
  new_number := 'TKT' || LPAD(counter::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
BEFORE INSERT ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_timestamp
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_ticket_timestamp();

-- Function to check if ticket is overdue
CREATE OR REPLACE FUNCTION check_ticket_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_due_date IS NOT NULL AND NEW.sla_due_date < now() AND NEW.status NOT IN ('resolved', 'closed') THEN
    NEW.is_overdue := true;
  ELSE
    NEW.is_overdue := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_overdue
BEFORE INSERT OR UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION check_ticket_overdue();

-- RLS Policies for support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tickets in their organization"
ON support_tickets FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tickets"
ON support_tickets FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can update tickets"
ON support_tickets FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'hr')
  )
);

-- RLS Policies for ticket_comments
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on tickets in their organization"
ON ticket_comments FOR SELECT
TO authenticated
USING (
  ticket_id IN (
    SELECT id FROM support_tickets WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create comments"
ON ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
  ticket_id IN (
    SELECT id FROM support_tickets WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for kb_articles
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view articles in their organization"
ON kb_articles FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage articles"
ON kb_articles FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'hr')
  )
);

-- Insert default SLA policies
INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT DISTINCT id, 'low'::ticket_priority, 48, 168 FROM organizations
ON CONFLICT (organization_id, priority) DO NOTHING;

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT DISTINCT id, 'medium'::ticket_priority, 24, 72 FROM organizations
ON CONFLICT (organization_id, priority) DO NOTHING;

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT DISTINCT id, 'high'::ticket_priority, 4, 24 FROM organizations
ON CONFLICT (organization_id, priority) DO NOTHING;

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT DISTINCT id, 'critical'::ticket_priority, 1, 8 FROM organizations
ON CONFLICT (organization_id, priority) DO NOTHING;
