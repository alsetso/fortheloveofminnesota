import { NextRequest } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const slideSchema = z.object({
  position: z.number().int().min(0),
  duration_seconds: z.number().int().min(1).max(30),
  expires_at: z.string().datetime(),
  background_type: z.enum(['image', 'video', 'color']),
  background_media_id: z.string().uuid().optional().nullable(),
  background_color: z.string().optional().nullable(),
});

const slidesSchema = z.array(slideSchema);

/**
 * GET /api/stories/[id]/slides
 * Get all slides for a story
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const storyId = params.id;

        const { data: slides, error } = await (supabase as any)
          .schema('stories')
          .from('slides')
          .select('*')
          .eq('story_id', storyId)
          .order('position', { ascending: true });

        if (error) {
          console.error('[GET /api/stories/[id]/slides] Error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch slides' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ slides: slides || [] }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('[GET /api/stories/[id]/slides] Unexpected error:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    },
    { rateLimit: 'public' }
  );
}

/**
 * POST /api/stories/[id]/slides
 * Create or update slides for a story
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const supabase = await createServerClientWithAuth(cookies());
        const storyId = params.id;

        // Verify story ownership
        const { data: story, error: storyError } = await (supabase as any)
          .schema('stories')
          .from('stories')
          .select('author_account_id')
          .eq('id', storyId)
          .single();

        if (storyError || !story) {
          return new Response(
            JSON.stringify({ error: 'Story not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (story.author_account_id !== accountId) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Parse and validate request body
        const body = await req.json().catch(() => ({}));
        const validation = slidesSchema.safeParse(body);

        if (!validation.success) {
          return new Response(
            JSON.stringify({
              error: 'Validation failed',
              details: validation.error.errors,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const slides = validation.data;

        // Delete existing slides
        const { error: deleteError } = await (supabase as any)
          .schema('stories')
          .from('slides')
          .delete()
          .eq('story_id', storyId);

        if (deleteError) {
          console.error('[POST /api/stories/[id]/slides] Delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to update slides' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Insert new slides
        if (slides.length > 0) {
          const slidesToInsert = slides.map((slide) => ({
            story_id: storyId,
            ...slide,
          }));

          const { error: insertError } = await (supabase as any)
            .schema('stories')
            .from('slides')
            .insert(slidesToInsert);

          if (insertError) {
            console.error('[POST /api/stories/[id]/slides] Insert error:', insertError);
            return new Response(
              JSON.stringify({ error: 'Failed to save slides' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, count: slides.length }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('[POST /api/stories/[id]/slides] Unexpected error:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    },
    { rateLimit: 'authenticated', requireAuth: true }
  );
}
