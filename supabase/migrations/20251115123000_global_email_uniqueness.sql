-- Global email uniqueness checks and enforcement
-- Adds an RPC to check global email usage and a trigger to enforce on employees

-- Function: public.is_email_in_use(p_email text)
CREATE OR REPLACE FUNCTION public.is_email_in_use(p_email text)
RETURNS TABLE(in_use boolean, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  col_exists boolean := false;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- 1) Check Supabase Auth users
  IF EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email
  ) THEN
    RETURN QUERY SELECT true, 'auth.users'::text;
    RETURN;
  END IF;

  -- 2) Check employees.company_email
  IF EXISTS (
    SELECT 1 FROM public.employees e WHERE e.company_email IS NOT NULL AND lower(e.company_email) = v_email
  ) THEN
    RETURN QUERY SELECT true, 'employees.company_email'::text;
    RETURN;
  END IF;

  -- 3) Optionally check employees.personal_email if the column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'personal_email'
  ) INTO col_exists;

  IF col_exists THEN
    IF EXISTS (
      SELECT 1 FROM public.employees e WHERE e.personal_email IS NOT NULL AND lower(e.personal_email) = v_email
    ) THEN
      RETURN QUERY SELECT true, 'employees.personal_email'::text;
      RETURN;
    END IF;
  END IF;

  -- 4) Optionally check organizations.email if the column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'email'
  ) INTO col_exists;

  IF col_exists THEN
    IF EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.email IS NOT NULL AND lower(o.email) = v_email
    ) THEN
      RETURN QUERY SELECT true, 'organizations.email'::text;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT false, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_email_in_use(text) TO anon, authenticated;

-- Function to raise error if email already exists
CREATE OR REPLACE FUNCTION public.assert_email_available(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM public.is_email_in_use(p_email) LIMIT 1;
  IF r.in_use THEN
    RAISE EXCEPTION 'Email already in use (source: %).', r.source USING ERRCODE = '23505';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_email_available(text) TO anon, authenticated;

-- Trigger to enforce on employees inserts/updates
CREATE OR REPLACE FUNCTION public.trg_employees_enforce_global_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_email IS NOT NULL AND length(trim(NEW.company_email)) > 0 THEN
    PERFORM public.assert_email_available(NEW.company_email);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'before_employees_email_check'
  ) THEN
    CREATE TRIGGER before_employees_email_check
    BEFORE INSERT OR UPDATE OF company_email ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.trg_employees_enforce_global_email();
  END IF;
END $$;
