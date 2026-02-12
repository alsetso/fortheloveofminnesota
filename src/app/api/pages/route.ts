import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClientWithAuth, createServerClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';
import { getServerAuth } from '@/lib/auth/getServerAuth';

const REQUEST_SIZE_LIMITS = {
  json: 1024 * 1024, // 1MB
};

/**
 * POST /api/pages
 * Create a new page
 * 
 * Security:
 * - Rate limited: 60 requests/minute
 * - Requires authentication
 * - Input validation with Zod
 */
const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  visibility: z.enum(['private', 'public', 'shared']).default('private'),
  icon: z.string().max(10).optional().nullable(),
  shortcut_color: z.string().max(50).optional().nullable(),
  is_shortcut: z.boolean().default(false),
});

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

        const validation = createPageSchema.safeParse(body);
        if (!validation.success) {
          return new Response(
            JSON.stringify({ 
              error: 'Validation failed',
              details: validation.error.errors 
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const {
          title,
          description,
          visibility,
          icon,
          shortcut_color,
          is_shortcut,
        } = validation.data;

        // Generate slug from title (simple slugification)
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 100);

        // Check if slug already exists
        const { data: existingPage } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('id')
          .eq('slug', slug)
          .single();

        // If slug exists, append a number
        let finalSlug = slug;
        if (existingPage) {
          let counter = 1;
          while (true) {
            const testSlug = `${slug}-${counter}`;
            const { data: testPage } = await (supabase as any)
              .schema('pages')
              .from('pages')
              .select('id')
              .eq('slug', testSlug)
              .single();
            
            if (!testPage) {
              finalSlug = testSlug;
              break;
            }
            counter++;
            if (counter > 100) {
              // Fallback: use UUID if too many collisions
              finalSlug = null;
              break;
            }
          }
        }

        // Get next shortcut_order if this is a shortcut
        let shortcutOrder = null;
        if (is_shortcut) {
          const { data: maxOrder } = await (supabase as any)
            .schema('pages')
            .from('pages')
            .select('shortcut_order')
            .eq('owner_id', accountId)
            .eq('is_shortcut', true)
            .order('shortcut_order', { ascending: false })
            .limit(1)
            .single();

          shortcutOrder = maxOrder?.shortcut_order !== null 
            ? (maxOrder?.shortcut_order || 0) + 1 
            : 1;
        }

        // Create page
        const { data: newPage, error: createError } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .insert({
            title,
            description,
            visibility,
            icon,
            shortcut_color: is_shortcut ? shortcut_color : null,
            is_shortcut,
            shortcut_order: shortcutOrder,
            slug: finalSlug,
            owner_id: accountId,
          })
          .select('id, title, slug, created_at')
          .single();

        if (createError) {
          console.error('[POST /api/pages] Error creating page:', createError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create page',
              details: createError.message 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(newPage),
          { 
            status: 201, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      } catch (error: any) {
        console.error('[POST /api/pages] Unexpected error:', error);
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
