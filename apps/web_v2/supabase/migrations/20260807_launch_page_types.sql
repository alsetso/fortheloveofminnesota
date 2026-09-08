-- Canonical launch page types for Minnesotans:
-- business, organization, event, public-figure
-- Keep legacy UG slugs so existing rows remain valid.

ALTER TABLE page.pages DROP CONSTRAINT IF EXISTS pages_page_type_check;

ALTER TABLE page.pages ADD CONSTRAINT pages_page_type_check
  CHECK (page_type = ANY (ARRAY[
    'business'::text,
    'organization'::text,
    'event'::text,
    'public-figure'::text,
    'local-business'::text,
    'company-organization'::text,
    'entertainment'::text,
    'community'::text,
    'cannabis'::text,
    'school'::text,
    'city'::text,
    'town'::text,
    'county'::text,
    'district'::text,
    'zipcode'::text,
    'congressional-district'::text
  ]));

COMMENT ON CONSTRAINT pages_page_type_check ON page.pages IS
  'Launch UG: business, organization, event, public-figure. Legacy UG retained. Entity-backed: school, city, town, county, district, zipcode, congressional-district.';
