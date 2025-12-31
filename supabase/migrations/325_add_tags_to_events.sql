-- Add tags column to events table
-- Tags are stored as JSONB array of objects with emoji and text

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.events.tags IS 'Array of tag objects with emoji and text. Format: [{"emoji": "🎉", "text": "Celebration"}, ...]';

-- Add index for tag queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN (tags);

