-- Helpdesk & Support System Migration
-- This migration creates a comprehensive helpdesk system with tickets, comments, attachments, and knowledge base

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
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ticket_number text UNIQUE NOT NULL,
  
  -- Reporter Information
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  -- Ticket Details
  category ticket_category NOT NULL,
  priority ticket_priority DEFAULT 'medium',
  subject text NOT NULL,
  description text NOT NULL,
  status ticket_status DEFAULT 'open',
  
  -- Assignment
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  
  -- Resolution
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  
  -- SLA Tracking
  sla_due_date timestamptz,
  is_overdue boolean DEFAULT false,
  first_response_at timestamptz,
  
  -- Metadata
  tags text[],
  is_internal boolean DEFAULT false,
  last_activity_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket Comments Table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  comment text NOT NULL,
  is_internal boolean DEFAULT false, -- Internal notes only visible to staff
  is_resolution boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket Attachments Table
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  comment_id uuid REFERENCES ticket_comments(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  
  created_at timestamptz DEFAULT now()
);

-- Ticket Activity Log Table
CREATE TABLE IF NOT EXISTS ticket_activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  activity_type text NOT NULL, -- 'created', 'status_changed', 'assigned', 'commented', 'resolved', 'closed', 'reopened'
  old_value text,
  new_value text,
  description text,
  
  created_at timestamptz DEFAULT now()
);

-- Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS kb_articles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  title text NOT NULL,
  content text NOT NULL,
  category ticket_category NOT NULL,
  tags text[],
  
  is_published boolean DEFAULT false,
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SLA Configuration Table
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  priority ticket_priority NOT NULL,
  response_time_hours integer NOT NULL, -- Hours for first response
  resolution_time_hours integer NOT NULL, -- Hours for resolution
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, priority)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_employee ON support_tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_overdue ON support_tickets(is_overdue);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_employee ON ticket_comments(employee_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
-- Create comment_id index only if the column exists (for idempotency across schemas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_attachments' AND column_name = 'comment_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_attachments_comment ON ticket_attachments(comment_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);

CREATE INDEX IF NOT EXISTS idx_kb_articles_org ON kb_articles(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category);
-- Only create the published index if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kb_articles' AND column_name = 'is_published'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(is_published);
  END IF;
END $$;

-- Function to generate unique ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  new_number text;
  year_prefix text;
  counter integer;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');
  
  SELECT COUNT(*) + 1 INTO counter
  FROM support_tickets
  WHERE ticket_number LIKE 'TKT-' || year_prefix || '%';
  
  new_number := 'TKT-' || year_prefix || LPAD(counter::text, 5, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticket activity timestamp
CREATE OR REPLACE FUNCTION update_ticket_activity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET last_activity_at = now()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update overdue status
CREATE OR REPLACE FUNCTION check_ticket_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_due_date IS NOT NULL AND NEW.status NOT IN ('resolved', 'closed') THEN
    NEW.is_overdue := (NEW.sla_due_date < now());
  ELSE
    NEW.is_overdue := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generic helper to bump updated_at on row updates (used by multiple tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_ARGV[0] IS NULL THEN
    NEW.updated_at := now();
  ELSE
    -- Optional: support passing a column name; default is updated_at
    EXECUTE format('SELECT now()::timestamptz') INTO NEW."%I" USING TG_ARGV[0];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_comments_updated_at
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sla_policies_updated_at
  BEFORE UPDATE ON sla_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update last activity on comments
CREATE TRIGGER update_ticket_activity_on_comment
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_activity_timestamp();

-- Trigger to check overdue status
CREATE TRIGGER check_ticket_overdue_trigger
  BEFORE INSERT OR UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_ticket_overdue();

-- Enable Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets

-- Employees can view their own tickets
CREATE POLICY "Employees can view own tickets"
  ON support_tickets FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Owners/Admins/HR can view all tickets in their organization
DROP POLICY IF EXISTS "Owners and staff can view all tickets" ON support_tickets;
CREATE POLICY "Owners and staff can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = support_tickets.organization_id
        AND om.role IN ('owner', 'admin', 'hr')
    )
  );

-- Assigned staff can view their assigned tickets
CREATE POLICY "Assigned staff can view tickets"
  ON support_tickets FOR SELECT
  USING (
    assigned_to IN (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Employees can create tickets
CREATE POLICY "Employees can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
        AND organization_id = support_tickets.organization_id
    )
  );

-- Employees can update their own tickets (limited)
CREATE POLICY "Employees can update own tickets"
  ON support_tickets FOR UPDATE
  USING (
    employee_id IN (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Owners/Admins/HR can update all tickets
DROP POLICY IF EXISTS "Staff can update all tickets" ON support_tickets;
CREATE POLICY "Staff can update all tickets"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = support_tickets.organization_id
        AND om.role IN ('owner', 'admin', 'hr')
    )
  );

-- RLS Policies for ticket_comments

-- Users can view comments on tickets they can access
DROP POLICY IF EXISTS "Users can view comments on accessible tickets" ON ticket_comments;
CREATE POLICY "Users can view comments on accessible tickets"
  ON ticket_comments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.user_id = auth.uid()
             AND om.organization_id = (SELECT organization_id FROM support_tickets WHERE id = ticket_comments.ticket_id)
             AND om.role IN ('owner', 'admin', 'hr')
         )
    )
    AND (
      is_internal = false
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin', 'hr')
      )
    )
  );

-- Users can add comments to accessible tickets
DROP POLICY IF EXISTS "Users can add comments" ON ticket_comments;
CREATE POLICY "Users can add comments"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    AND ticket_id IN (
      SELECT id FROM support_tickets
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.user_id = auth.uid()
             AND om.organization_id = support_tickets.organization_id
             AND om.role IN ('owner', 'admin', 'hr')
         )
    )
  );

-- RLS Policies for ticket_attachments
DROP POLICY IF EXISTS "Users can view attachments on accessible tickets" ON ticket_attachments;
CREATE POLICY "Users can view attachments on accessible tickets"
  ON ticket_attachments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.user_id = auth.uid()
             AND om.organization_id = (SELECT organization_id FROM support_tickets WHERE id = ticket_attachments.ticket_id)
             AND om.role IN ('owner', 'admin', 'hr')
         )
    )
  );

DROP POLICY IF EXISTS "Users can add attachments" ON ticket_attachments;
DO $$
BEGIN
  -- If legacy column employee_id exists, use it; otherwise use uploaded_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_attachments' AND column_name = 'employee_id'
  ) THEN
    CREATE POLICY "Users can add attachments"
      ON ticket_attachments FOR INSERT
      WITH CHECK (
        employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
      );
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_attachments' AND column_name = 'uploaded_by'
  ) THEN
    CREATE POLICY "Users can add attachments"
      ON ticket_attachments FOR INSERT
      WITH CHECK (
        uploaded_by IN (SELECT id FROM employees WHERE user_id = auth.uid())
      );
  ELSE
    -- Fallback: allow insert if the user can access the ticket; tighten later if schema stabilizes
    CREATE POLICY "Users can add attachments"
      ON ticket_attachments FOR INSERT
      WITH CHECK (
        ticket_id IN (
          SELECT id FROM support_tickets
          WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
             OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- RLS Policies for ticket_activities
DROP POLICY IF EXISTS "Users can view activities on accessible tickets" ON ticket_activities;
CREATE POLICY "Users can view activities on accessible tickets"
  ON ticket_activities FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
         OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.user_id = auth.uid()
             AND om.organization_id = (SELECT organization_id FROM support_tickets WHERE id = ticket_activities.ticket_id)
             AND om.role IN ('owner', 'admin', 'hr')
         )
    )
  );

CREATE POLICY "System can insert activities"
  ON ticket_activities FOR INSERT
  WITH CHECK (true);

-- RLS Policies for kb_articles

-- Published articles visible to all employees in organization
DROP POLICY IF EXISTS "Employees can view published articles" ON kb_articles;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kb_articles' AND column_name = 'is_published'
  ) THEN
    CREATE POLICY "Employees can view published articles"
      ON kb_articles FOR SELECT
      USING (
        is_published = true
        AND organization_id IN (
          SELECT organization_id FROM employees
          WHERE user_id = auth.uid()
        )
      );
  ELSE
    -- Fallback when column is not present: allow viewing by organization membership
    CREATE POLICY "Employees can view published articles"
      ON kb_articles FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM employees
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Staff can manage articles
DROP POLICY IF EXISTS "Staff can manage articles" ON kb_articles;
CREATE POLICY "Staff can manage articles"
  ON kb_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = kb_articles.organization_id
        AND om.role IN ('owner', 'admin', 'hr')
    )
  );

-- RLS Policies for sla_policies
DROP POLICY IF EXISTS "Staff can manage SLA policies" ON sla_policies;
CREATE POLICY "Staff can manage SLA policies"
  ON sla_policies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = sla_policies.organization_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- Insert default SLA policies for existing organizations
INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT 
  id,
  'low'::ticket_priority,
  48,
  120
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM sla_policies
  WHERE sla_policies.organization_id = organizations.id
  AND sla_policies.priority = 'low'
);

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT 
  id,
  'medium'::ticket_priority,
  24,
  72
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM sla_policies
  WHERE sla_policies.organization_id = organizations.id
  AND sla_policies.priority = 'medium'
);

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT 
  id,
  'high'::ticket_priority,
  8,
  24
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM sla_policies
  WHERE sla_policies.organization_id = organizations.id
  AND sla_policies.priority = 'high'
);

INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
SELECT 
  id,
  'critical'::ticket_priority,
  2,
  8
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM sla_policies
  WHERE sla_policies.organization_id = organizations.id
  AND sla_policies.priority = 'critical'
);

-- Function to add default SLA policies for new organizations
CREATE OR REPLACE FUNCTION add_default_sla_policies()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sla_policies (organization_id, priority, response_time_hours, resolution_time_hours)
  VALUES
    (NEW.id, 'low', 48, 120),
    (NEW.id, 'medium', 24, 72),
    (NEW.id, 'high', 8, 24),
    (NEW.id, 'critical', 2, 8);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add default SLA policies to new organizations
DROP TRIGGER IF EXISTS add_default_sla_policies_trigger ON organizations;
CREATE TRIGGER add_default_sla_policies_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION add_default_sla_policies();
