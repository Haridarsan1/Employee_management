/*
  # Ensure default expense categories for every new organization

  - Adds a helper function ensure_default_expense_categories(p_organization_id)
  - Adds AFTER INSERT trigger on organizations to seed defaults automatically
  - Idempotent inserts (ON CONFLICT DO NOTHING using unique (organization_id, name))
*/

-- Helper to ensure default categories exist for an organization
CREATE OR REPLACE FUNCTION ensure_default_expense_categories(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default categories if not already present
  INSERT INTO expense_categories (organization_id, name, description, requires_receipt, max_amount, is_active)
  SELECT p_organization_id, cat_name, cat_desc, requires_receipt, max_amount, true
  FROM (
    VALUES
      ('Travel', 'Business travel expenses', true, 50000),
      ('Food', 'Meals & entertainment', true, 5000),
      ('Accommodation', 'Hotel and lodging', true, 20000),
      ('Transportation', 'Local transport, parking, tolls', true, 8000),
      ('Office Supplies', 'Stationery and office items', true, 10000),
      ('Client Meeting', 'Client-related expenses', true, 7000),
      ('Internet/Mobile', 'Communication expenses', true, 3000),
      ('Software/Tools', 'SaaS and tools', false, 15000),
      ('Fuel', 'Fuel & conveyance', true, 8000),
      ('Miscellaneous', 'Other business expenses', false, NULL)
  ) AS defs(cat_name, cat_desc, requires_receipt, max_amount)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- Trigger to seed defaults on new organization creation

-- Create trigger function wrapper (triggers cannot pass NEW as arg directly)
CREATE OR REPLACE FUNCTION trg_fn_seed_default_expense_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM ensure_default_expense_categories(NEW.id);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seed_default_expense_categories'
  ) THEN
    CREATE TRIGGER trg_seed_default_expense_categories
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_seed_default_expense_categories();
  END IF;
END $$;
