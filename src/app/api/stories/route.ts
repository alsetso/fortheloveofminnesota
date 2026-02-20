import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

/**
 * POST /api/stories
 * Create a new story
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Input validation with Zod
 */
const createStorySchema = z.object({
  visibility: z.enum(['private', 'public', 'shared']).default('private'),
  map_id: z.string().uuid().optional().nullable(),
});

// Map form visibility values to database values
// 'private' -> 'private' (only author can see, handled by RLS)
// 'public' -> 'public' (anyone can view)
// 'shared' -> 'followers' (only followers can view)
function mapVisibilityToDatabase(formVisibility: 'private' | 'public' | 'shared'): 'private' | 'public' | 'followers' {
  if (formVisibility === 'shared') {
    return 'followers';
  }
  return formVisibility;
}

export async function POST(request: NextRequest) {
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

        // Validate request body
        const body = await req.json().catch(() => ({}));
        
        if (Object.keys(body).length === 0) {
          return new Response(
            JSON.stringify({ error: 'Request body is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const validation = createStorySchema.safeParse(body);
        if (!validation.success) {
          return new Response(
            JSON.stringify({ 
              error: 'Validation failed',
              details: validation.error.issues 
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const {
          visibility: formVisibility,
          map_id,
        } = validation.data;

        // Map form visibility to database visibility
        const dbVisibility = mapVisibilityToDatabase(formVisibility);

        // Create story
        const { data: newStory, error: createError } = await (supabase as any)
          .schema('stories')
          .from('stories')
          .insert({
            author_account_id: accountId,
            visibility: dbVisibility,
            map_id: map_id || null,
          })
          .select('id, created_at')
          .single();

        if (createError) {
          console.error('[POST /api/stories] Error creating story:', createError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create story',
              details: createError.message 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(newStory),
          { 
            status: 201, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      } catch (error: any) {
        console.error('[POST /api/stories] Unexpected error:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Internal server error',
            message: error.message 
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  );
}
