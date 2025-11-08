/*
  # Fix Existing Users Setup

  ## Problem
  Users who logged in before the multi-tenant setup don't have profiles or organization memberships.

  ## Solution
  1. Create user profiles for existing auth users
  2. Create organizations for users without one
  3. Link users to their organizations
*/

-- Create profiles and organizations for existing users who don't have them
DO $$
DECLARE
  auth_user RECORD;
  new_org_id uuid;
BEGIN
  FOR auth_user IN SELECT id, email FROM auth.users
  LOOP
    -- Check if user already has a profile
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth_user.id) THEN
      
      -- Check if user owns an organization
      IF EXISTS (SELECT 1 FROM organizations WHERE owner_id = auth_user.id) THEN
        -- User has org but no profile - get org id
        SELECT id INTO new_org_id FROM organizations WHERE owner_id = auth_user.id LIMIT 1;
      ELSE
        -- Create organization for this user
        INSERT INTO organizations (
          name,
          slug,
          subdomain,
          owner_id,
          trial_ends_at
        ) VALUES (
          COALESCE(SPLIT_PART(auth_user.email, '@', 1), 'My Organization'),
          LOWER(REGEXP_REPLACE(COALESCE(SPLIT_PART(auth_user.email, '@', 1), 'org'), '[^a-z0-9]+', '-', 'g')) || '-' || SUBSTRING(auth_user.id::text, 1, 8),
          LOWER(REGEXP_REPLACE(COALESCE(SPLIT_PART(auth_user.email, '@', 1), 'org'), '[^a-z0-9]+', '-', 'g')) || '-' || SUBSTRING(auth_user.id::text, 1, 8),
          auth_user.id,
          NOW() + INTERVAL '14 days'
        )
        RETURNING id INTO new_org_id;

        -- Create subscription for the organization
        INSERT INTO organization_subscriptions (
          organization_id,
          plan_id,
          status,
          interval,
          amount,
          current_period_start,
          current_period_end,
          trial_start,
          trial_end
        )
        SELECT
          new_org_id,
          id,
          'trial',
          'monthly',
          999,
          NOW(),
          NOW() + INTERVAL '14 days',
          NOW(),
          NOW() + INTERVAL '14 days'
        FROM subscription_plans
        WHERE name = 'Starter'
        LIMIT 1;
      END IF;

      -- Create user profile
      INSERT INTO user_profiles (
        user_id,
        current_organization_id,
        is_active
      ) VALUES (
        auth_user.id,
        new_org_id,
        true
      );

      -- Create organization membership
      IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = auth_user.id AND organization_id = new_org_id
      ) THEN
        INSERT INTO organization_members (
          organization_id,
          user_id,
          role,
          is_active
        ) VALUES (
          new_org_id,
          auth_user.id,
          'admin',
          true
        );
      END IF;

      RAISE NOTICE 'Created profile and organization for user: %', auth_user.email;
    END IF;
  END LOOP;
END $$;
