import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/billing/usage
 * Returns current usage counts for key features (maps, posts, collections, etc.)
 * 
 * Security:
 * - Rate limited: 100 requests/minute
 * - Requires authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        if (!accountId) {
          return NextResponse.json(
            { error: 'Account not found', message: 'No active account selected' },
            { status: 404 }
          );
        }
        
        // Feature-to-resource mapping: maps feature slugs to their database tables
        // This allows automatic usage counting for features
        const FEATURE_RESOURCE_MAP: Record<string, string> = {
          // Map-related features all use the 'map' table
          'custom_maps': 'map',
          'map': 'map',
          'unlimited_maps': 'map',
          // Post-related features
          'posts': 'posts',
          'post': 'posts',
          // Collection-related features
          'collections': 'collections',
          'collection': 'collections',
          // Group-related features
          'groups': 'groups',
          'group': 'groups',
        };
        
        // Get all account features to determine which resources to count
        const { data: accountFeatures, error: featuresError } = await supabase.rpc(
          'get_account_features_with_limits',
          { account_id: accountId } as any
        );
        
        const usage: Record<string, number> = {};
        
        // Track which tables we've already counted (to avoid duplicate queries)
        const countedTables = new Set<string>();
        const tableCounts: Record<string, number> = {};
        
        // Count resources for each feature
        if (Array.isArray(accountFeatures)) {
          for (const feature of accountFeatures as any[]) {
            const featureSlug = feature.feature_slug;
            const resourceTable = FEATURE_RESOURCE_MAP[featureSlug];
            
            // Only count if feature has a count limit and we have a resource mapping
            if (resourceTable && (feature.limit_type === 'count' || feature.is_unlimited)) {
              // Count the table if we haven't already
              if (!countedTables.has(resourceTable)) {
                try {
                  const { count } = await supabase
                    .from(resourceTable)
                    .select('*', { count: 'exact', head: true })
                    .eq('account_id', accountId);
                  tableCounts[resourceTable] = count ?? 0;
                  countedTables.add(resourceTable);
                } catch (error) {
                  // Table doesn't exist or error - set to 0
                  tableCounts[resourceTable] = 0;
                  countedTables.add(resourceTable);
                }
              }
              
              // Assign the count to this feature slug
              usage[featureSlug] = tableCounts[resourceTable];
            }
          }
        }
        
        // Also set generic keys for backward compatibility
        if (tableCounts['map'] !== undefined) {
          usage.maps = tableCounts['map'];
        }
        if (tableCounts['posts'] !== undefined) {
          usage.posts = tableCounts['posts'];
        }
        if (tableCounts['collections'] !== undefined) {
          usage.collections = tableCounts['collections'];
        }
        if (tableCounts['groups'] !== undefined) {
          usage.groups = tableCounts['groups'];
        }
        
        return NextResponse.json({ accountId, usage });
      } catch (error) {
        console.error('[Billing API] Error fetching usage:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: { windowMs: 60 * 1000, maxRequests: 100 },
    }
  );
}
