-- accounts column cleanup — drop unused legacy fields; keep product + attribution.
--
-- KEEPS (do not drop):
--   Identity / auth
--     id, user_id, username, first_name, last_name, email, phone,
--     image_url, cover_image_url, bio, role, traits, guest_id,
--     created_at, updated_at, status
--   Profile / social privacy
--     search_visibility, account_taggable, hide_followers, hide_following,
--     owns_business, business_name, account_type, about, website_url, office_hours,
--     claim_status, view_count
--   Place (canonical ids — not legacy jsonb blobs)
--     city_id, county_id
--   Verification / onboarding
--     state_verified, state_verification_checked_at,
--     onboarded, onboarding_completed_at,
--     account_demo_steps, skipped_demo
--   Billing
--     stripe_customer_id, plan, subscription_status
--   Home / avatar / game presence
--     home_territory_stack_id, home_set_at, home_reset_available_at,
--     avatar_model_id, pose_state
--   Legal
--     terms_version_id, privacy_version_id, terms_accepted_at, privacy_accepted_at
--   Attribution (explicitly retained)
--     last_visit, referral_source,
--     signup_page_url, signup_referrer_url, signup_source_detail,
--     signup_opened_at, signup_attributed_at
--
-- Note: accounts.person_id does NOT link the contact book
-- (contacts.people / enrichments use their own person ids + account_id;
--  CRM link is admin.persons.account_id). Safe to drop.
--
-- DROPS (18):
--   cities_and_towns, county (jsonb), districts, zipcode (jsonb),
--   home_geofence, home_geofence_updated_at,
--   person_id, claimed_at, claimed_by_account_id,
--   total_points, engagement_score,
--   deactivated_at, reactivation_requested_at,
--   billing_mode, onboarded_contributor,
--   referred_by_affiliate_id, referred_at, total_spent_cents

-- Triggers that write columns being dropped
DROP TRIGGER IF EXISTS trg_accounts_prevent_self_referral ON public.accounts;
DROP TRIGGER IF EXISTS trg_accounts_sync_deactivated_at ON public.accounts;

DROP FUNCTION IF EXISTS public.prevent_self_referral();
DROP FUNCTION IF EXISTS public.accounts_sync_deactivated_at();

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS cities_and_towns,
  DROP COLUMN IF EXISTS county,
  DROP COLUMN IF EXISTS districts,
  DROP COLUMN IF EXISTS zipcode,
  DROP COLUMN IF EXISTS home_geofence,
  DROP COLUMN IF EXISTS home_geofence_updated_at,
  DROP COLUMN IF EXISTS person_id,
  DROP COLUMN IF EXISTS claimed_at,
  DROP COLUMN IF EXISTS claimed_by_account_id,
  DROP COLUMN IF EXISTS total_points,
  DROP COLUMN IF EXISTS engagement_score,
  DROP COLUMN IF EXISTS deactivated_at,
  DROP COLUMN IF EXISTS reactivation_requested_at,
  DROP COLUMN IF EXISTS billing_mode,
  DROP COLUMN IF EXISTS onboarded_contributor,
  DROP COLUMN IF EXISTS referred_by_affiliate_id,
  DROP COLUMN IF EXISTS referred_at,
  DROP COLUMN IF EXISTS total_spent_cents;
