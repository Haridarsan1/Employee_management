/*
  # Comprehensive HRMS Features - All Modules

  ## Overview
  Complete HRMS system with notifications, chat, performance management, training,
  expenses, helpdesk, meetings, engagement, documents, benefits, and recruitment.

  ## New Tables

  ### Notifications System
  1. `notifications` - Push notifications for all events
  2. `notification_preferences` - User notification settings

  ### Chat & Messaging
  3. `chat_channels` - Team channels and DMs
  4. `chat_messages` - Messages in channels
  5. `chat_members` - Channel membership

  ### Performance Management
  6. `performance_goals` - Employee goals (OKRs/KPIs)
  7. `performance_reviews` - Review cycles
  8. `performance_feedback` - 360-degree feedback
  9. `skills` - Skills catalog
  10. `employee_skills` - Employee skill ratings

  ### Training & Development
  11. `training_courses` - Course catalog
  12. `training_enrollments` - Course enrollments
  13. `training_completions` - Completed courses
  14. `certifications` - Certification tracking

  ### Expense Management
  15. `expense_claims` - Expense submissions
  16. `expense_items` - Individual expense items
  17. `expense_categories` - Expense types

  ### Helpdesk & Support
  18. `support_tickets` - IT/HR support tickets
  19. `ticket_comments` - Ticket conversations
  20. `ticket_categories` - Ticket types

  ### Meeting Room Booking
  21. `meeting_rooms` - Room inventory
  22. `room_bookings` - Reservations
  23. `room_equipment` - Equipment in rooms

  ### Employee Engagement
  24. `company_announcements` - Company news
  25. `employee_polls` - Surveys and polls
  26. `poll_responses` - Poll answers
  27. `recognition_badges` - Recognition awards

  ### Document Management
  28. `document_categories` - Document types
  29. `employee_documents` - Document storage
  30. `document_access_logs` - Audit trail

  ### Benefits Management
  31. `benefit_plans` - Available benefits
  32. `employee_benefits` - Enrolled benefits
  33. `benefit_claims` - Claims processing
  34. `tax_declarations` - Tax filing

  ### Recruitment
  35. `job_postings` - Open positions
  36. `job_applications` - Applicants
  37. `interviews` - Interview schedules
  38. `candidate_evaluations` - Interview feedback

  ## Security
  - Enable RLS on all tables
  - Role-based access control
  - Audit logging
  - Data encryption ready
*/

-- =====================================================
-- NOTIFICATIONS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'task', 'leave', 'attendance', 'payroll')),
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  task_updates boolean DEFAULT true,
  leave_updates boolean DEFAULT true,
  attendance_reminders boolean DEFAULT true,
  chat_messages boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- CHAT & MESSAGING
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  channel_type text DEFAULT 'group' CHECK (channel_type IN ('direct', 'group', 'team', 'announcement')),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  message text NOT NULL,
  reply_to uuid REFERENCES chat_messages(id),
  attachments jsonb DEFAULT '[]',
  reactions jsonb DEFAULT '{}',
  is_edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at timestamptz,
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(channel_id, user_id)
);

-- =====================================================
-- PERFORMANCE MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  goal_type text DEFAULT 'okr' CHECK (goal_type IN ('okr', 'kpi', 'personal')),
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES employees(id) NOT NULL,
  review_period text NOT NULL,
  review_type text DEFAULT 'annual' CHECK (review_type IN ('annual', 'quarterly', 'probation', '360')),
  overall_rating numeric CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths text,
  areas_for_improvement text,
  comments text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'completed')),
  review_date date,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS performance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  feedback_by uuid REFERENCES employees(id) NOT NULL,
  feedback_type text DEFAULT 'peer' CHECK (feedback_type IN ('peer', 'manager', 'self', 'subordinate')),
  category text,
  rating numeric CHECK (rating >= 1 AND rating <= 5),
  feedback text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  proficiency_level text DEFAULT 'beginner' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_of_experience numeric,
  last_used_date date,
  endorsed_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, skill_id)
);

-- =====================================================
-- TRAINING & DEVELOPMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  course_type text DEFAULT 'online' CHECK (course_type IN ('online', 'classroom', 'hybrid', 'external')),
  category text,
  duration_hours numeric,
  instructor text,
  max_participants integer,
  is_mandatory boolean DEFAULT false,
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES training_courses(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  enrolled_by uuid REFERENCES auth.users(id) NOT NULL,
  status text DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'dropped')),
  progress_percentage numeric DEFAULT 0,
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(course_id, employee_id)
);

CREATE TABLE IF NOT EXISTS training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES training_enrollments(id) ON DELETE CASCADE NOT NULL,
  completion_date date NOT NULL,
  score numeric,
  feedback text,
  certificate_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  certification_name text NOT NULL,
  issuing_organization text NOT NULL,
  issue_date date NOT NULL,
  expiry_date date,
  credential_id text,
  credential_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- EXPENSE MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  requires_receipt boolean DEFAULT true,
  max_amount numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  claim_number text NOT NULL UNIQUE,
  title text NOT NULL,
  total_amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  submitted_at timestamptz,
  approved_by uuid REFERENCES employees(id),
  approved_at timestamptz,
  rejection_reason text,
  payment_date date,
  payment_reference text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES expense_claims(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES expense_categories(id) NOT NULL,
  expense_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  receipt_url text,
  merchant_name text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- HELPDESK & SUPPORT
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  department text CHECK (department IN ('it', 'hr', 'admin', 'finance', 'facilities')),
  default_assignee uuid REFERENCES employees(id),
  sla_hours integer DEFAULT 24,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ticket_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES ticket_categories(id) NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  created_by uuid REFERENCES employees(id) NOT NULL,
  assigned_to uuid REFERENCES employees(id),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- MEETING ROOM BOOKING
-- =====================================================

CREATE TABLE IF NOT EXISTS meeting_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  capacity integer NOT NULL,
  floor text,
  amenities text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS room_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES meeting_rooms(id) ON DELETE CASCADE NOT NULL,
  equipment_name text NOT NULL,
  quantity integer DEFAULT 1,
  is_working boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES meeting_rooms(id) ON DELETE CASCADE NOT NULL,
  booked_by uuid REFERENCES employees(id) NOT NULL,
  meeting_title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  attendees text[] DEFAULT '{}',
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  cancellation_reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- EMPLOYEE ENGAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS company_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  announcement_type text DEFAULT 'general' CHECK (announcement_type IN ('general', 'urgent', 'celebration', 'policy')),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  is_pinned boolean DEFAULT false,
  publish_date timestamptz DEFAULT now() NOT NULL,
  expiry_date timestamptz,
  target_audience text[] DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  poll_type text DEFAULT 'single' CHECK (poll_type IN ('single', 'multiple', 'text')),
  options jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  is_anonymous boolean DEFAULT false,
  start_date timestamptz DEFAULT now() NOT NULL,
  end_date timestamptz NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES employee_polls(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS recognition_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  given_to uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  given_by uuid REFERENCES employees(id) NOT NULL,
  badge_type text NOT NULL,
  title text NOT NULL,
  message text,
  points integer DEFAULT 0,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- DOCUMENT MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  requires_expiry boolean DEFAULT false,
  is_mandatory boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES document_categories(id) NOT NULL,
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  document_number text,
  issue_date date,
  expiry_date date,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES employee_documents(id) ON DELETE CASCADE NOT NULL,
  accessed_by uuid REFERENCES auth.users(id) NOT NULL,
  action text CHECK (action IN ('view', 'download', 'edit', 'delete')),
  ip_address text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- BENEFITS MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS benefit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL,
  plan_type text CHECK (plan_type IN ('health', 'retirement', 'insurance', 'wellness', 'other')),
  description text,
  provider text,
  coverage_details jsonb,
  employee_contribution numeric DEFAULT 0,
  employer_contribution numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  effective_date date NOT NULL,
  end_date date,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES benefit_plans(id) ON DELETE CASCADE NOT NULL,
  enrollment_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  coverage_start_date date NOT NULL,
  coverage_end_date date,
  dependents jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, plan_id)
);

CREATE TABLE IF NOT EXISTS benefit_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_id uuid REFERENCES employee_benefits(id) ON DELETE CASCADE NOT NULL,
  claim_number text NOT NULL UNIQUE,
  claim_type text NOT NULL,
  claim_amount numeric NOT NULL,
  claim_date date NOT NULL,
  description text,
  supporting_documents jsonb DEFAULT '[]',
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'paid')),
  approved_amount numeric,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  financial_year text NOT NULL,
  regime text CHECK (regime IN ('old', 'new')),
  declarations jsonb NOT NULL,
  proof_documents jsonb DEFAULT '[]',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'approved', 'rejected')),
  submitted_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, financial_year)
);

-- =====================================================
-- RECRUITMENT MODULE
-- =====================================================

CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  job_title text NOT NULL,
  department text NOT NULL,
  location text NOT NULL,
  employment_type text CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  experience_required text,
  salary_min numeric,
  salary_max numeric,
  job_description text NOT NULL,
  requirements text NOT NULL,
  skills_required text[] DEFAULT '{}',
  benefits text,
  posted_by uuid REFERENCES auth.users(id) NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'on_hold')),
  application_deadline date,
  positions_available integer DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES job_postings(id) ON DELETE CASCADE NOT NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text,
  resume_url text NOT NULL,
  cover_letter text,
  current_ctc numeric,
  expected_ctc numeric,
  notice_period_days integer,
  linkedin_url text,
  portfolio_url text,
  status text DEFAULT 'applied' CHECK (status IN ('applied', 'screening', 'shortlisted', 'interview', 'offered', 'rejected', 'hired')),
  applied_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
  interview_round integer NOT NULL,
  interview_type text CHECK (interview_type IN ('phone', 'video', 'in_person', 'technical', 'hr')),
  scheduled_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  interviewer_ids uuid[] NOT NULL,
  meeting_link text,
  location text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  feedback text,
  rating numeric CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE NOT NULL,
  evaluator_id uuid REFERENCES employees(id) NOT NULL,
  technical_skills numeric CHECK (technical_skills >= 1 AND technical_skills <= 5),
  communication_skills numeric CHECK (communication_skills >= 1 AND communication_skills <= 5),
  problem_solving numeric CHECK (problem_solving >= 1 AND problem_solving <= 5),
  cultural_fit numeric CHECK (cultural_fit >= 1 AND cultural_fit <= 5),
  overall_rating numeric CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths text,
  weaknesses text,
  recommendation text CHECK (recommendation IN ('strong_hire', 'hire', 'maybe', 'no_hire')),
  comments text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_employee ON performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_employee ON training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_employee ON expense_claims(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_bookings_time ON room_bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(job_id, status);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognition_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_evaluations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Notifications
-- =====================================================

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - Chat
-- =====================================================

CREATE POLICY "Users can view channels they are members of"
  ON chat_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_channels.id
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view messages in their channels"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their channels"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.channel_id = chat_messages.channel_id
      AND chat_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- =====================================================
-- RLS POLICIES - Performance
-- =====================================================

CREATE POLICY "Employees can view their own goals"
  ON performance_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = performance_goals.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage employee goals"
  ON performance_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = performance_goals.employee_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'hr', 'manager')
    )
  );

-- =====================================================
-- RLS POLICIES - Expenses
-- =====================================================

CREATE POLICY "Employees can manage their own expense claims"
  ON expense_claims FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = expense_claims.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view all expense claims"
  ON expense_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = expense_claims.employee_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'hr', 'finance')
    )
  );

-- =====================================================
-- RLS POLICIES - Helpdesk
-- =====================================================

CREATE POLICY "Users can create support tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = support_tickets.created_by
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = support_tickets.created_by
      AND om.user_id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - Documents
-- =====================================================

CREATE POLICY "Employees can view their own documents"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.id = om.employee_id
      WHERE e.id = employee_documents.employee_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can manage all employee documents"
  ON employee_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = employee_documents.employee_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- RLS POLICIES - Recruitment
-- =====================================================

CREATE POLICY "HR can manage job postings"
  ON job_postings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_postings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR can manage applications"
  ON job_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_postings jp
      JOIN organization_members om ON jp.organization_id = om.organization_id
      WHERE jp.id = job_applications.job_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- GENERAL RLS POLICIES (Organization-based access)
-- =====================================================

CREATE POLICY "Organization members can view their org data"
  ON training_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = training_courses.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can view announcements"
  ON company_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_announcements.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can view meeting rooms"
  ON meeting_rooms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = meeting_rooms.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can book rooms"
  ON room_bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_rooms mr
      JOIN organization_members om ON mr.organization_id = om.organization_id
      JOIN employees e ON e.id = room_bookings.booked_by
      WHERE mr.id = room_bookings.room_id
      AND om.user_id = auth.uid()
      AND e.id = om.employee_id
    )
  );
