-- NOTIFICATION SYSTEM MIGRATION - Run this in Supabase Dashboard SQL Editor
-- Go to: https://supabase.com/dashboard/project/idhozyvxxxnznqzhrhrs/sql/new

-- Step 1: Create enums (safe - will skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('leave','announcement','payroll','task','goal','expense','performance','system');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
    CREATE TYPE notification_priority AS ENUM ('normal','high','critical');
  END IF;
END $$;

-- Step 2: Drop existing notifications table if it exists (fresh start)
DROP TABLE IF EXISTS notifications CASCADE;

-- Step 3: Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id uuid NULL,
  receiver_id uuid NULL,
  title text NOT NULL,
  message text,
  type notification_type NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  read_status boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 4: Create indexes
CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_receiver ON notifications(receiver_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(read_status) WHERE read_status = false;
CREATE INDEX idx_notifications_not_deleted ON notifications(deleted) WHERE deleted = false;

-- Step 5: Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies
-- Step 6: Create policies
CREATE POLICY notifications_select ON notifications 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = notifications.organization_id 
      AND om.user_id = auth.uid()
    )
    AND (notifications.receiver_id = auth.uid() OR notifications.sender_id = auth.uid())
    AND notifications.deleted = false
  );

CREATE POLICY notifications_insert ON notifications 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = notifications.organization_id 
      AND om.user_id = auth.uid()
    )
    AND notifications.sender_id = auth.uid()
    AND (
      notifications.receiver_id IS NULL OR EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = notifications.organization_id 
        AND om2.user_id = notifications.receiver_id
      )
    )
  );

CREATE POLICY notifications_update ON notifications 
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = notifications.organization_id 
      AND om.user_id = auth.uid()
    )
    AND notifications.receiver_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.organization_id = notifications.organization_id 
      AND om.user_id = auth.uid()
    )
    AND notifications.receiver_id = auth.uid()
  );

CREATE POLICY notifications_delete ON notifications 
  FOR DELETE 
  USING (false);

-- Step 7: Add announcement notification tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='announcements' AND column_name='notification_sent_at'
  ) THEN
    ALTER TABLE announcements ADD COLUMN notification_sent_at timestamptz;
    CREATE INDEX idx_announcements_notification_sent ON announcements(notification_sent_at);
  END IF;
END $$;

-- Step 8: Create function to process scheduled announcements
CREATE OR REPLACE FUNCTION process_due_announcement_notifications() 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $fn$
DECLARE
  a RECORD;
  m RECORD;
BEGIN
  FOR a IN
    SELECT * FROM announcements
    WHERE status = 'published'
      AND (published_at IS NULL OR published_at <= now())
      AND notification_sent_at IS NULL
  LOOP
    FOR m IN
      SELECT user_id FROM organization_members WHERE organization_id = a.organization_id
    LOOP
      IF a.created_by IS NULL OR m.user_id <> a.created_by THEN
        INSERT INTO notifications(
          organization_id, sender_id, receiver_id, title, message, type, priority, metadata
        ) VALUES (
          a.organization_id, 
          a.created_by, 
          m.user_id, 
          a.title, 
          left(coalesce(regexp_replace(a.content, '<[^>]+>', ' ', 'g'), ''), 200), 
          'announcement', 
          'normal',
          jsonb_build_object('announcement_id', a.id)
        );
      END IF;
    END LOOP;
    
    UPDATE announcements SET notification_sent_at = now() WHERE id = a.id;
  END LOOP;
END;
$fn$;

-- Verification queries (optional - run these to confirm)
-- SELECT COUNT(*) as notification_count FROM notifications;
-- SELECT * FROM pg_policies WHERE tablename = 'notifications';
-- \df process_due_announcement_notifications
