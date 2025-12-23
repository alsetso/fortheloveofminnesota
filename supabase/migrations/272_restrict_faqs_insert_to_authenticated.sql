-- Restrict FAQ question submission to authenticated users only
-- Removes anonymous access to INSERT operations

-- Drop the old policy that allowed anonymous users
DROP POLICY IF EXISTS "Anyone can submit questions" ON public.faqs;

-- Create new policy that only allows authenticated users
CREATE POLICY "Authenticated users can submit questions"
  ON public.faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Revoke INSERT permission from anonymous users
REVOKE INSERT ON public.faqs FROM anon;

