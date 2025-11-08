/*
  # Add Default Expense Categories

  Adds common expense categories for Indian organizations
*/

INSERT INTO expense_categories (organization_id, name, description, requires_receipt, max_amount)
SELECT 
  id,
  category_name,
  description,
  requires_receipt,
  max_amount
FROM organizations,
LATERAL (VALUES
  ('Travel', 'Business travel expenses', true, 50000),
  ('Meals & Entertainment', 'Client meetings and team meals', true, 5000),
  ('Office Supplies', 'Stationery and office items', true, 10000),
  ('Internet & Phone', 'Communication expenses', true, 3000),
  ('Training & Conferences', 'Professional development', true, 25000),
  ('Software & Subscriptions', 'SaaS and tools', false, 15000),
  ('Fuel & Conveyance', 'Local transport', true, 8000),
  ('Parking & Tolls', 'Parking and toll charges', true, 2000)
) AS cats(category_name, description, requires_receipt, max_amount)
ON CONFLICT DO NOTHING;

INSERT INTO ticket_categories (organization_id, name, department, sla_hours)
SELECT 
  id,
  category_name,
  department,
  sla_hours
FROM organizations,
LATERAL (VALUES
  ('Hardware Issue', 'it', 24),
  ('Software Issue', 'it', 12),
  ('Network Problem', 'it', 4),
  ('Leave Query', 'hr', 48),
  ('Payroll Query', 'hr', 24),
  ('Policy Question', 'hr', 48),
  ('Facility Request', 'facilities', 48),
  ('Equipment Request', 'facilities', 72)
) AS cats(category_name, department, sla_hours)
ON CONFLICT DO NOTHING;
