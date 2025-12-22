-- Update account_trait enum to comprehensive list of 119 traits
-- Replaces old enum values with new comprehensive trait system

-- ============================================================================
-- STEP 1: Create new enum type with all trait values
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_trait_new') THEN
    CREATE TYPE public.account_trait_new AS ENUM (
      -- ❤️ Emotional & Meaning
      'sentimental',
      'nostalgic',
      'reflective',
      'introspective',
      'peace-seeking',
      'hopeful',
      'healing',
      'grateful',
      -- 🌲 Care, Stewardship & Responsibility
      'steward',
      'protector',
      'guardian',
      'caretaker',
      'sustainability-minded',
      'prepared',
      'duty-driven',
      -- 🧭 Exploration & Curiosity
      'explorer',
      'curious',
      'wanderer',
      'adventurous',
      'experimental',
      'traveler',
      -- 🏘️ Belonging & Place Identity
      'localist',
      'rooted',
      'neighborhood-focused',
      'hometown-proud',
      'belonging-driven',
      'place-attached',
      -- 🧑‍🤝‍🧑 Social & Community Energy
      'connector',
      'relationship-builder',
      'organizer',
      'gatherer',
      'helper',
      'supportive',
      'communicative',
      -- 🧑‍🎨 Expression & Creativity
      'storyteller',
      'writer',
      'expressive',
      'documentarian',
      'artistic',
      'poetic',
      -- 🧠 Observation & Insight
      'observer',
      'pattern-seeker',
      'analytical',
      'detail-oriented',
      'context-aware',
      'systems-thinking',
      -- 🧓 Time, Memory & Legacy
      'keeper-of-memory',
      'historian',
      'archivist',
      'tradition-oriented',
      'legacy-minded',
      'remembrance-focused',
      -- 🌆🌾 Environment Orientation
      'urban-focused',
      'city-oriented',
      'infrastructure-aware',
      'development-curious',
      'pedestrian-minded',
      'rural-rooted',
      'land-connected',
      'nature-centered',
      'outdoor-oriented',
      'solitude-seeking',
      -- ⚙️ Practical & Situational Awareness
      'problem-solver',
      'fixer',
      'navigator',
      'watchful',
      'safety-focused',
      -- 🌱 Engagement Style
      'quiet-participant',
      'conversational',
      'selective',
      'repeat-visitor',
      'saver',
      'reactor',
      -- 🧘 Energy, Pace & Rhythm
      'slow-paced',
      'high-energy',
      'optimistic',
      'contemplative',
      'emotionally-fluid',
      'seasonally-adaptive',
      -- 💼 Economic Participation & Work
      'business-owner',
      'local-shop-owner',
      'hospitality-operator',
      'property-owner',
      'side-hustler',
      'service-provider',
      'tradesperson',
      'builder',
      'technician',
      'creative-worker',
      'educator',
      'care-worker',
      'food-worker',
      'remote-worker',
      'mobile-worker',
      'gig-contract-worker',
      'student-worker',
      'retired-semi-retired',
      -- 🔁 Value Creation & Commerce Style
      'knowledge-based',
      'hands-on',
      'creative-driven',
      'product-based',
      'relationship-based',
      'process-driven',
      'advisory-focused',
      'local-consumer',
      'buy-local-advocate',
      'circular-economy-minded',
      'budget-conscious',
      'experience-driven',
      'impact-driven',
      'formal-business',
      'micro-commerce',
      'peer-to-peer',
      'event-based',
      'pop-up-temporary',
      'digital-only',
      'economy-observant',
      'trend-aware',
      'place-value-oriented'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate data to new enum type
-- ============================================================================

-- Drop the index temporarily
DROP INDEX IF EXISTS public.accounts_traits_idx;

-- Add temporary column with new enum type
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS traits_new public.account_trait_new[] DEFAULT '{}';

-- Convert and migrate data
-- Map old trait values to new ones where they exist, otherwise clear traits
DO $$
DECLARE
  account_record RECORD;
  old_trait public.account_trait;
  new_traits public.account_trait_new[];
  trait_text text;
BEGIN
  FOR account_record IN SELECT id, traits FROM public.accounts WHERE traits IS NOT NULL AND array_length(traits, 1) > 0
  LOOP
    new_traits := '{}'::public.account_trait_new[];
    
    FOREACH old_trait IN ARRAY account_record.traits
    LOOP
      trait_text := old_trait::text;
      
      -- Map old trait values to new enum if they exist
      -- Most old traits won't map, so we'll only keep valid ones
      IF trait_text IN (
        'homeowner', 'buyer', 'investor', 'realtor', 'wholesaler', 
        'lender', 'title', 'renter', 'businessowner'
      ) THEN
        -- Map old values to new ones
        CASE trait_text
          WHEN 'businessowner' THEN trait_text := 'business-owner';
          ELSE NULL; -- Keep as-is if it matches
        END CASE;
        
        BEGIN
          new_traits := array_append(new_traits, trait_text::public.account_trait_new);
        EXCEPTION WHEN OTHERS THEN
          -- Skip invalid enum values
          NULL;
        END;
      END IF;
    END LOOP;
    
    UPDATE public.accounts
    SET traits_new = new_traits
    WHERE id = account_record.id;
  END LOOP;
END $$;

-- Drop old column
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS traits;

-- Rename new column to original name
ALTER TABLE public.accounts
  RENAME COLUMN traits_new TO traits;

-- ============================================================================
-- STEP 3: Drop old enum and rename new enum
-- ============================================================================

-- Drop old enum type
DROP TYPE IF EXISTS public.account_trait CASCADE;

-- Rename new enum to original name
ALTER TYPE public.account_trait_new RENAME TO account_trait;

-- ============================================================================
-- STEP 4: Recreate index and update comments
-- ============================================================================

-- Recreate the index
CREATE INDEX IF NOT EXISTS accounts_traits_idx
  ON public.accounts USING GIN (traits)
  WHERE traits IS NOT NULL AND array_length(traits, 1) > 0;

-- Update comments
COMMENT ON TYPE public.account_trait IS
  'Enum type for account traits that define user perspectives and activities on MNUDA. Users can select multiple traits from 119 available options organized into 15 categories.';

COMMENT ON COLUMN public.accounts.traits IS
  'Array of account traits that help define the account''s perspectives and activities on MNUDA. Users can select multiple traits from 119 available options covering emotional meaning, care & stewardship, exploration, belonging, social energy, expression, observation, memory & legacy, environment orientation, practical awareness, engagement style, energy & pace, economic participation, value creation, and economic awareness.';
