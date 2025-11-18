-- Create notifications system: table, enums, indexes, RLS, helper function for scheduled announcements
DO $$
BEGIN
  -- Enums
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('leave','announcement','payroll','task','goal','expense','performance','system');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
    CREATE TYPE notification_priority AS ENUM ('normal','high','critical');
  END IF;

  -- Table
  CREATE TABLE IF NOT EXISTS notifications (
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

  CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_status) WHERE read_status = false;
  CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted ON notifications(deleted) WHERE deleted = false;

  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

  -- Policies
  -- Select: user can see notifications they received or sent, within their org
  DROP POLICY IF EXISTS notifications_select ON notifications;
  CREATE POLICY notifications_select ON notifications FOR SELECT
    USING (
      notifications.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND (notifications.receiver_id = auth.uid() OR notifications.sender_id = auth.uid())
      AND notifications.deleted = false
    );

  -- Insert: allow org members to insert notifications for their org, receiver must be in same org if provided
  DROP POLICY IF EXISTS notifications_insert ON notifications;
  CREATE POLICY notifications_insert ON notifications FOR INSERT
    WITH CHECK (
      notifications.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND notifications.sender_id = auth.uid()
      AND (
        notifications.receiver_id IS NULL OR EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = notifications.organization_id AND om.user_id = notifications.receiver_id
        )
      )
    );

  -- Update: allow receiver to mark read/delete; sender cannot change after send
  DROP POLICY IF EXISTS notifications_update ON notifications;
  CREATE POLICY notifications_update ON notifications FOR UPDATE
    USING (
      notifications.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND notifications.receiver_id = auth.uid()
    )
    WITH CHECK (
      notifications.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND notifications.receiver_id = auth.uid()
    );

  -- Delete: disallow hard delete via RLS (use soft delete flag)
  DROP POLICY IF EXISTS notifications_delete ON notifications;
  CREATE POLICY notifications_delete ON notifications FOR DELETE USING (false);

  -- Support scheduled announcement notifications: add flag and function
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='announcements' AND column_name='notification_sent_at'
  ) THEN
    ALTER TABLE announcements ADD COLUMN notification_sent_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_announcements_notification_sent ON announcements(notification_sent_at);
  END IF;

  -- Function to process due announcements and generate notifications for all org members (excluding sender if present)
  CREATE OR REPLACE FUNCTION process_due_announcement_notifications() RETURNS void AS $fn$
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
      -- For each member in the organization, create a notification
      FOR m IN
        SELECT user_id FROM organization_members WHERE organization_id = a.organization_id
      LOOP
        IF a.created_by IS NULL OR m.user_id <> a.created_by THEN
          INSERT INTO notifications(
            organization_id, sender_id, receiver_id, title, message, type, priority, metadata
          ) VALUES (
            a.organization_id, a.created_by, m.user_id, a.title, left(coalesce(regexp_replace(a.content, '<[^>]+>', ' ', 'g'), ''), 200), 'announcement', 'normal',
            jsonb_build_object('announcement_id', a.id)
          );
        END IF;
      END LOOP;

      UPDATE announcements SET notification_sent_at = now() WHERE id = a.id;
    END LOOP;
  END;
  $fn$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Note: schedule this function to run periodically (e.g., every minute) using Supabase Scheduled Functions or pg_cron.
END $$;
