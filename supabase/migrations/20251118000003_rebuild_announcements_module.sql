-- Rebuild Announcements module: categories, priority, status, scheduling, attachments, reads, strict multi-tenancy
DO $$
BEGIN
  -- Enums
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_category') THEN
    CREATE TYPE announcement_category AS ENUM ('general','holiday','event','hr_update','alert');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_priority') THEN
    CREATE TYPE announcement_priority AS ENUM ('low','normal','high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_status') THEN
    CREATE TYPE announcement_status AS ENUM ('draft','published');
  END IF;

  -- Base table adjustments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='organization_id'
  ) THEN
    ALTER TABLE announcements ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='category'
  ) THEN
    ALTER TABLE announcements ADD COLUMN category announcement_category DEFAULT 'general'::announcement_category;
  END IF;

  -- Keep legacy 'type' if present, but we prefer 'category'. Optionally migrate values
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='type'
  ) THEN
    BEGIN
      UPDATE announcements SET category = CASE lower(type)
        WHEN 'general' THEN 'general'::announcement_category
        WHEN 'holiday' THEN 'holiday'::announcement_category
        WHEN 'event' THEN 'event'::announcement_category
        WHEN 'hr update' THEN 'hr_update'::announcement_category
        WHEN 'alert' THEN 'alert'::announcement_category
        ELSE 'general'::announcement_category END;
    EXCEPTION WHEN OTHERS THEN
      -- ignore mapping errors
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='priority'
  ) THEN
    ALTER TABLE announcements ADD COLUMN priority announcement_priority DEFAULT 'normal'::announcement_priority;
  ELSE
    -- If priority exists as text, try cast to enum by adding a shadow column
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='announcements' AND column_name='priority') <> 'USER-DEFINED' THEN
      ALTER TABLE announcements ADD COLUMN priority_enum announcement_priority;
      UPDATE announcements SET priority_enum = CASE lower(priority)
        WHEN 'low' THEN 'low'::announcement_priority
        WHEN 'high' THEN 'high'::announcement_priority
        ELSE 'normal'::announcement_priority END;
      ALTER TABLE announcements DROP COLUMN priority;
      ALTER TABLE announcements RENAME COLUMN priority_enum TO priority;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='status'
  ) THEN
    ALTER TABLE announcements ADD COLUMN status announcement_status DEFAULT 'draft'::announcement_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='banner_image_url'
  ) THEN
    ALTER TABLE announcements ADD COLUMN banner_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='attachments'
  ) THEN
    ALTER TABLE announcements ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  -- Ensure published_at exists for scheduling
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='published_at'
  ) THEN
    ALTER TABLE announcements ADD COLUMN published_at timestamptz;
  END IF;

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_announcements_org ON announcements(organization_id);
  CREATE INDEX IF NOT EXISTS idx_announcements_status_pub ON announcements(status, published_at);
  CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category);
  CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

  -- Enable RLS
  EXECUTE 'ALTER TABLE announcements ENABLE ROW LEVEL SECURITY';

  -- Policies
  DROP POLICY IF EXISTS ann_owner_crud ON announcements;
  CREATE POLICY ann_owner_crud ON announcements FOR ALL
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
    )
    WITH CHECK (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
    );

  DROP POLICY IF EXISTS ann_employee_read ON announcements;
  CREATE POLICY ann_employee_read ON announcements FOR SELECT
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND (
        -- owners can see all; employees see only published and not future
        EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = auth.uid() AND om.organization_id = announcements.organization_id AND om.role = 'owner')
        OR (status = 'published' AND (published_at IS NULL OR published_at <= now()))
      )
    );

  -- Per-user read tracking
  CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    read_at timestamptz DEFAULT now(),
    PRIMARY KEY (announcement_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

  EXECUTE 'ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY';

  DROP POLICY IF EXISTS reads_self ON announcement_reads;
  CREATE POLICY reads_self ON announcement_reads FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM announcements a
        JOIN organization_members om ON om.organization_id = a.organization_id AND om.user_id = auth.uid()
        WHERE a.id = announcement_reads.announcement_id
      )
    );

END $$;
