-- Migration: Update performance management tables for comprehensive goal and review tracking
-- This migration enhances the existing performance_goals and performance_reviews tables

-- Add missing columns to performance_goals table
DO $$ 
BEGIN
  -- Add progress column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_goals' AND column_name = 'progress'
  ) THEN
    ALTER TABLE performance_goals ADD COLUMN progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
  END IF;

  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_goals' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE performance_goals ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add organization_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_goals' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE performance_goals ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    -- Populate organization_id from employee relationship
    UPDATE performance_goals pg
    SET organization_id = e.organization_id
    FROM employees e
    WHERE pg.employee_id = e.id AND pg.organization_id IS NULL;
    
    ALTER TABLE performance_goals ALTER COLUMN organization_id SET NOT NULL;
  END IF;

  -- Update goal_type check constraint to include more types
  ALTER TABLE performance_goals DROP CONSTRAINT IF EXISTS performance_goals_goal_type_check;
  ALTER TABLE performance_goals ADD CONSTRAINT performance_goals_goal_type_check 
    CHECK (goal_type IN ('okr', 'kpi', 'project', 'personal', 'team'));

  -- Update status check constraint to include overdue
  ALTER TABLE performance_goals DROP CONSTRAINT IF EXISTS performance_goals_status_check;
  ALTER TABLE performance_goals ADD CONSTRAINT performance_goals_status_check 
    CHECK (status IN ('active', 'completed', 'overdue', 'cancelled'));
END $$;

-- Rename performance_goals to goals for consistency
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'performance_goals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'goals'
  ) THEN
    ALTER TABLE performance_goals RENAME TO goals;
  END IF;
END $$;

-- Update performance_reviews table
DO $$ 
BEGIN
  -- Add organization_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    -- Populate organization_id from employee relationship
    UPDATE performance_reviews pr
    SET organization_id = e.organization_id
    FROM employees e
    WHERE pr.employee_id = e.id AND pr.organization_id IS NULL;
    
    ALTER TABLE performance_reviews ALTER COLUMN organization_id SET NOT NULL;
  END IF;

  -- Rename review_period to review_cycle if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'review_period'
  ) THEN
    ALTER TABLE performance_reviews RENAME COLUMN review_period TO review_cycle;
  END IF;

  -- Add rating column (rename from overall_rating if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'overall_rating'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'rating'
  ) THEN
    ALTER TABLE performance_reviews RENAME COLUMN overall_rating TO rating;
  END IF;

  -- Add feedback column (rename from comments if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'comments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'feedback'
  ) THEN
    ALTER TABLE performance_reviews RENAME COLUMN comments TO feedback;
  END IF;

  -- Add areas_for_improvement if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'areas_for_improvement'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN areas_for_improvement text;
  END IF;

  -- Add goals_met column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'goals_met'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN goals_met boolean;
  END IF;

  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Update review_type check constraint
  ALTER TABLE performance_reviews DROP CONSTRAINT IF EXISTS performance_reviews_review_type_check;
  ALTER TABLE performance_reviews ADD CONSTRAINT performance_reviews_review_type_check 
    CHECK (review_type IN ('quarterly', 'half_yearly', 'annual', 'probation', 'performance_improvement'));

  -- Update status check constraint
  ALTER TABLE performance_reviews DROP CONSTRAINT IF EXISTS performance_reviews_status_check;
  ALTER TABLE performance_reviews ADD CONSTRAINT performance_reviews_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));
END $$;

-- Create goal_updates table for tracking progress updates
CREATE TABLE IF NOT EXISTS goal_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  updated_by uuid REFERENCES employees(id) NOT NULL,
  progress integer NOT NULL CHECK (progress >= 0 AND progress <= 100),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_goals_employee_id ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_organization_id ON goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_due_date ON goals(end_date);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_organization_id ON performance_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer_id ON performance_reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_goal_updates_goal_id ON goal_updates(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_created_at ON goal_updates(created_at DESC);

-- Enable RLS on new table
ALTER TABLE goal_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goals table
DROP POLICY IF EXISTS "Users can view goals in their organization" ON goals;
CREATE POLICY "Users can view goals in their organization"
  ON goals FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can create goals" ON goals;
CREATE POLICY "Managers can create goals"
  ON goals FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

DROP POLICY IF EXISTS "Managers can update goals" ON goals;
CREATE POLICY "Managers can update goals"
  ON goals FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

DROP POLICY IF EXISTS "Managers can delete goals" ON goals;
CREATE POLICY "Managers can delete goals"
  ON goals FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

-- RLS Policies for performance_reviews table
DROP POLICY IF EXISTS "Users can view reviews in their organization" ON performance_reviews;
CREATE POLICY "Users can view reviews in their organization"
  ON performance_reviews FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can create reviews" ON performance_reviews;
CREATE POLICY "Managers can create reviews"
  ON performance_reviews FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

DROP POLICY IF EXISTS "Managers can update reviews" ON performance_reviews;
CREATE POLICY "Managers can update reviews"
  ON performance_reviews FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

-- RLS Policies for goal_updates table
DROP POLICY IF EXISTS "Users can view goal updates in their organization" ON goal_updates;
CREATE POLICY "Users can view goal updates in their organization"
  ON goal_updates FOR SELECT
  USING (
    goal_id IN (
      SELECT g.id FROM goals g
      INNER JOIN organization_members om ON g.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Employees can create their own goal updates" ON goal_updates;
CREATE POLICY "Employees can create their own goal updates"
  ON goal_updates FOR INSERT
  WITH CHECK (
    goal_id IN (
      SELECT g.id FROM goals g
      INNER JOIN organization_members om ON g.employee_id = om.employee_id
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can create any goal updates" ON goal_updates;
CREATE POLICY "Managers can create any goal updates"
  ON goal_updates FOR INSERT
  WITH CHECK (
    goal_id IN (
      SELECT g.id FROM goals g
      INNER JOIN organization_members om ON g.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'hr', 'manager')
    )
  );

-- Function to automatically update goal status based on progress and due date
CREATE OR REPLACE FUNCTION update_goal_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progress >= 100 THEN
    NEW.status := 'completed';
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF NEW.end_date < CURRENT_DATE AND NEW.progress < 100 THEN
    NEW.status := 'overdue';
  ELSIF NEW.status = 'completed' AND NEW.progress < 100 THEN
    NEW.status := 'active';
    NEW.completed_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic status updates
DROP TRIGGER IF EXISTS trigger_update_goal_status ON goals;
CREATE TRIGGER trigger_update_goal_status
  BEFORE INSERT OR UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_status();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to goals if column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE goals ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_goals_updated_at ON goals;
CREATE TRIGGER trigger_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_performance_reviews_updated_at ON performance_reviews;
CREATE TRIGGER trigger_performance_reviews_updated_at
  BEFORE UPDATE ON performance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
