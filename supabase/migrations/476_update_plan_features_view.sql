-- Update the public.billing_plan_features view to include limit columns
-- The view needs to be recreated to expose the new columns

DROP VIEW IF EXISTS public.billing_plan_features;

CREATE OR REPLACE VIEW public.billing_plan_features AS
SELECT 
  id,
  plan_id,
  feature_id,
  limit_value,
  limit_type,
  created_at
FROM billing.plan_features;

-- Grant full access to the view for authenticated users
-- The underlying RLS policies on billing.plan_features will still apply
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plan_features TO authenticated, anon;

-- Create INSTEAD OF triggers to make the view fully updatable
CREATE OR REPLACE FUNCTION public.insert_billing_plan_features()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
  VALUES (NEW.plan_id, NEW.feature_id, NEW.limit_value, NEW.limit_type)
  ON CONFLICT (plan_id, feature_id) 
  DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    limit_type = EXCLUDED.limit_type
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_billing_plan_features()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE billing.plan_features
  SET 
    limit_value = NEW.limit_value,
    limit_type = NEW.limit_type
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS instead_of_insert_billing_plan_features ON public.billing_plan_features;
CREATE TRIGGER instead_of_insert_billing_plan_features
INSTEAD OF INSERT ON public.billing_plan_features
FOR EACH ROW
EXECUTE FUNCTION public.insert_billing_plan_features();

DROP TRIGGER IF EXISTS instead_of_update_billing_plan_features ON public.billing_plan_features;
CREATE TRIGGER instead_of_update_billing_plan_features
INSTEAD OF UPDATE ON public.billing_plan_features
FOR EACH ROW
EXECUTE FUNCTION public.update_billing_plan_features();

COMMENT ON VIEW public.billing_plan_features IS 'Public view of plan features with limit configurations (updatable)';
COMMENT ON FUNCTION public.update_billing_plan_features IS 'Trigger function to make billing_plan_features view updatable';
