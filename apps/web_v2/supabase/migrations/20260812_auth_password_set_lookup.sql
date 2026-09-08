-- Track whether the user intentionally set a password (OTP-era users have a
-- bcrypt hash they do not know). Backfill existing auth users to false.
-- Lookup RPC powers welcome email branching without creating accounts.

UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('password_set', false)
WHERE COALESCE((raw_user_meta_data->>'password_set')::boolean, false) IS NOT TRUE;

COMMENT ON COLUMN auth.users.raw_user_meta_data IS
  'Includes password_set (boolean): true only after user chose a password via signup/setup.';

CREATE OR REPLACE FUNCTION public.lookup_auth_email(p_email text)
RETURNS TABLE (user_exists boolean, has_password boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  normalized text;
  meta jsonb;
BEGIN
  normalized := lower(trim(p_email));
  IF normalized IS NULL OR normalized = '' OR position('@' in normalized) = 0 THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  SELECT u.raw_user_meta_data
  INTO meta
  FROM auth.users u
  WHERE lower(u.email) = normalized
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    COALESCE((meta->>'password_set')::boolean, false);
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lookup_auth_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_auth_email(text) TO authenticated;

COMMENT ON FUNCTION public.lookup_auth_email(text) IS
  'Welcome email probe: returns whether an auth user exists and password_set metadata.';
