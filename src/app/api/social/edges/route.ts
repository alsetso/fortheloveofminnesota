import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { cookies } from 'next/headers';

const createEdgeSchema = z.object({
  to_account_id: z.string().uuid(),
  relationship: z.enum(['follow', 'block']), // Removed 'friend' - mutual follows = friends
});

const updateEdgeSchema = z.object({
  edge_id: z.string().uuid(),
  status: z.enum(['pending', 'accepted']).optional(),
});

const deleteEdgeSchema = z.object({
  edge_id: z.string().uuid(),
});

/**
 * POST /api/social/edges
 * Create a new social edge (follow, friend request, block)
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const validation = await validateRequestBody(req, createEdgeSchema);
        
        if (!validation.success) {
          return validation.error;
        }

        const { to_account_id, relationship } = validation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Get current user's account
        const { data: fromAccount, error: accountError } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId!)
          .eq('id', accountId!)
          .single();

        if (accountError || !fromAccount) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        // Check if edge already exists
        const { data: existingEdge } = await supabase
          .schema('social_graph')
          .from('edges')
          .select('id, status')
          .eq('from_account_id', fromAccount.id)
          .eq('to_account_id', to_account_id)
          .eq('relationship', relationship)
          .single();

        if (existingEdge) {
          // If already exists and accepted, check for mutual follow
          if (existingEdge.status === 'accepted') {
            let isMutualFollow = false;
            if (relationship === 'follow') {
              const { data: reverseEdge } = await supabase
                .schema('social_graph')
                .from('edges')
                .select('id')
                .eq('from_account_id', to_account_id)
                .eq('to_account_id', fromAccount.id)
                .eq('relationship', 'follow')
                .eq('status', 'accepted')
                .single();

              isMutualFollow = !!reverseEdge;
            }
            
            return NextResponse.json({
              edge: existingEdge,
              isMutualFollow,
              message: 'Relationship already exists',
            });
          }
          // If pending, update to accepted
          const { data: updatedEdge, error: updateError } = await supabase
            .schema('social_graph')
            .from('edges')
            .update({ status: 'accepted' })
            .eq('id', existingEdge.id)
            .select()
            .single();

          if (updateError) {
            return NextResponse.json(
              { error: updateError.message },
              { status: 500 }
            );
          }

          // Check for mutual follow after update
          let isMutualFollow = false;
          if (relationship === 'follow') {
            const { data: reverseEdge } = await supabase
              .schema('social_graph')
              .from('edges')
              .select('id')
              .eq('from_account_id', to_account_id)
              .eq('to_account_id', fromAccount.id)
              .eq('relationship', 'follow')
              .eq('status', 'accepted')
              .single();

            isMutualFollow = !!reverseEdge;
          }

          return NextResponse.json({ 
            edge: updatedEdge,
            isMutualFollow 
          });
        }

        // Determine initial status
        // Follow and block are auto-accepted
        const initialStatus = 'accepted';

        // Create new edge
        const { data: newEdge, error: createError } = await supabase
          .schema('social_graph')
          .from('edges')
          .insert({
            from_account_id: fromAccount.id,
            to_account_id: to_account_id,
            relationship,
            status: initialStatus,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: createError.message },
            { status: 500 }
          );
        }

        // Check for mutual follows (if this is a follow relationship)
        let isMutualFollow = false;
        if (relationship === 'follow') {
          const { data: reverseEdge } = await supabase
            .schema('social_graph')
            .from('edges')
            .select('id')
            .eq('from_account_id', to_account_id)
            .eq('to_account_id', fromAccount.id)
            .eq('relationship', 'follow')
            .eq('status', 'accepted')
            .single();

          isMutualFollow = !!reverseEdge;
        }

        return NextResponse.json({ 
          edge: newEdge,
          isMutualFollow 
        }, { status: 201 });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/social/edges:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * PATCH /api/social/edges
 * Update an existing edge (e.g., accept friend request)
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const validation = await validateRequestBody(req, updateEdgeSchema);
        
        if (!validation.success) {
          return validation.error;
        }

        const { edge_id, status } = validation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Verify user owns the edge (either as sender or receiver)
        const { data: edge, error: fetchError } = await supabase
          .schema('social_graph')
          .from('edges')
          .select('from_account_id, to_account_id')
          .eq('id', edge_id)
          .single();

        if (fetchError || !edge) {
          return NextResponse.json(
            { error: 'Edge not found' },
            { status: 404 }
          );
        }

        // Check if user owns either account
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId!)
          .in('id', [edge.from_account_id, edge.to_account_id]);

        if (!accounts || accounts.length === 0) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }

        // Update edge
        const updateData: { status?: string } = {};
        if (status) {
          updateData.status = status;
        }

        const { data: updatedEdge, error: updateError } = await supabase
          .schema('social_graph')
          .from('edges')
          .update(updateData)
          .eq('id', edge_id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ edge: updatedEdge });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in PATCH /api/social/edges:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * DELETE /api/social/edges
 * Delete a social edge (unfollow, remove friend, unblock)
 */
export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { searchParams } = new URL(req.url);
        const edge_id = searchParams.get('edge_id');
        
        if (!edge_id) {
          return NextResponse.json(
            { error: 'edge_id is required' },
            { status: 400 }
          );
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Verify user owns the edge (as sender)
        const { data: edge, error: fetchError } = await supabase
          .schema('social_graph')
          .from('edges')
          .select('from_account_id')
          .eq('id', edge_id)
          .single();

        if (fetchError || !edge) {
          return NextResponse.json(
            { error: 'Edge not found' },
            { status: 404 }
          );
        }

        // Check if user owns the from_account
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId!)
          .eq('id', edge.from_account_id)
          .single();

        if (!account) {
          return NextResponse.json(
            { error: 'Unauthorized - can only delete edges you created' },
            { status: 403 }
          );
        }

        // Delete edge
        const { error: deleteError } = await supabase
          .schema('social_graph')
          .from('edges')
          .delete()
          .eq('id', edge_id);

        if (deleteError) {
          return NextResponse.json(
            { error: deleteError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in DELETE /api/social/edges:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
