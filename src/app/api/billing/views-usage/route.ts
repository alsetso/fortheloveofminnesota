import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * In-memory cache for views usage data
 * Key: account_id:date_range
 * Value: { data, timestamp }
 */
const viewsUsageCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (between 5-15 min as specified)

/**
 * GET /api/billing/views-usage
 * Returns aggregated map views for the current account
 * 
 * Query params:
 * - date_range: '30' | '90' | 'all' (default: '30')
 * - page: number (default: 1)
 * - limit: number (default: 20)
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
        
        // userId and accountId are guaranteed from security middleware
        if (!accountId) {
          return NextResponse.json(
            { error: 'Account not found', message: 'No active account selected' },
            { status: 404 }
          );
        }

        // Parse query parameters
        const url = new URL(req.url);
        const dateRange = (url.searchParams.get('date_range') || '30') as '30' | '90' | 'all';
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        // Check cache (cache key doesn't include page/limit - we cache full dataset)
        const cacheKey = `${accountId}:${dateRange}`;
        const cached = viewsUsageCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS && cached.data.allViews) {
          // Return cached data with pagination applied
          const allViews = cached.data.allViews;
          const paginatedViews = allViews.slice(offset, offset + limit);
          
          const paginatedData = {
            views: paginatedViews,
            total_count: cached.data.total_count,
            total_views: cached.data.total_views,
            page,
            limit,
            total_pages: Math.ceil(cached.data.total_count / limit),
            date_range: cached.data.date_range,
          };
          return NextResponse.json(paginatedData);
        }

        // Fetch all views first (for caching), then paginate
        // Use a large limit to get all results for caching
        const MAX_CACHE_LIMIT = 10000; // Reasonable upper bound
        
        const [allViewsResult, countResult] = await Promise.all([
          supabase.rpc('get_account_map_views', {
            p_account_id: accountId,
            p_date_range: dateRange,
            p_limit: MAX_CACHE_LIMIT,
            p_offset: 0,
          } as any),
          supabase.rpc('get_account_map_views_count', {
            p_account_id: accountId,
            p_date_range: dateRange,
          } as any),
        ]);

        // Check for errors
        if (allViewsResult.error || countResult.error) {
          console.error('[Views Usage API] Database function error:', {
            viewsError: allViewsResult.error,
            countError: countResult.error,
          });
          
          // Fallback: aggregate in memory (not ideal, but works)
          // Fallback: fetch raw data and aggregate in memory (not ideal, but works)
          const { data: rawViews, error: rawError } = await supabase
            .from('map_views')
            .select(`
              map_id,
              viewed_at,
              map:map!inner(
                id,
                name,
                slug,
                is_active
              )
            `)
            .eq('account_id', accountId)
            .eq('map.is_active', true)
            .order('viewed_at', { ascending: false });

          if (rawError) {
            console.error('[Views Usage API] Error fetching views:', rawError);
            return NextResponse.json(
              { error: 'Failed to fetch views', views: [], total_count: 0, total_views: 0 },
              { status: 500 }
            );
          }

          // Apply date filter
          const now = new Date();
          const filteredViews = (rawViews || []).filter((view: any) => {
            if (!view.viewed_at) return false;
            const viewedAt = new Date(view.viewed_at);
            if (dateRange === '30') {
              return viewedAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            } else if (dateRange === '90') {
              return viewedAt >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            }
            return true;
          });

          // Aggregate by map_id
          const aggregated = new Map<string, {
            id: string;
            name: string;
            slug: string | null;
            view_count: number;
            last_viewed: string;
            first_viewed: string;
          }>();

          filteredViews.forEach((view: any) => {
            if (!view.map || !view.map.id) return;
            const mapId = view.map.id;
            const existing = aggregated.get(mapId);
            
            if (existing) {
              existing.view_count++;
              const viewedAt = new Date(view.viewed_at);
              const lastViewed = new Date(existing.last_viewed);
              const firstViewed = new Date(existing.first_viewed);
              
              if (viewedAt > lastViewed) {
                existing.last_viewed = view.viewed_at;
              }
              if (viewedAt < firstViewed) {
                existing.first_viewed = view.viewed_at;
              }
            } else {
              aggregated.set(mapId, {
                id: mapId,
                name: view.map.name || 'Unnamed Map',
                slug: view.map.slug || null,
                view_count: 1,
                last_viewed: view.viewed_at,
                first_viewed: view.viewed_at,
              });
            }
          });

          // Convert to array and sort by last_viewed DESC
          const views = Array.from(aggregated.values())
            .sort((a, b) => new Date(b.last_viewed).getTime() - new Date(a.last_viewed).getTime())
            .slice(offset, offset + limit);

          const totalCount = aggregated.size;
          const totalViews = Array.from(aggregated.values()).reduce((sum, v) => sum + v.view_count, 0);

          const result = {
            views,
            total_count: totalCount,
            total_views: totalViews,
            page,
            limit,
            total_pages: Math.ceil(totalCount / limit),
            date_range: dateRange,
          };

          // Cache the full result (all aggregated views, not just current page)
          const allViews = Array.from(aggregated.values())
            .sort((a, b) => new Date(b.last_viewed).getTime() - new Date(a.last_viewed).getTime());
          
          // Apply pagination to response
          const paginatedViews = allViews.slice(offset, offset + limit);
          
          viewsUsageCache.set(cacheKey, {
            data: {
              allViews: allViews, // Cache full dataset
              total_count: totalCount,
              total_views: totalViews,
              date_range: dateRange,
            },
            timestamp: Date.now(),
          });
          
          return NextResponse.json({
            views: paginatedViews,
            total_count: totalCount,
            total_views: totalViews,
            page,
            limit,
            total_pages: Math.ceil(totalCount / limit),
            date_range: dateRange,
          });

          return NextResponse.json(result);
        }

        // Transform database function results to API format
        const allViews = ((allViewsResult.data as any[]) || []).map((row: any) => ({
          id: row.map_id,
          name: row.map_name || 'Unnamed Map',
          slug: row.map_slug,
          view_count: Number(row.view_count),
          last_viewed: row.last_viewed,
          first_viewed: row.first_viewed,
        }));

        const totalCount = (countResult?.data as any)?.[0]?.total_count
          ? Number((countResult.data as any)[0].total_count) 
          : allViews.length;
        const totalViews = (countResult?.data as any)?.[0]?.total_views
          ? Number((countResult.data as any)[0].total_views)
          : allViews.reduce((sum: number, v: any) => sum + v.view_count, 0);

        // Apply pagination
        const paginatedViews = allViews.slice(offset, offset + limit);

        // Cache the full result (all views, not paginated)
        viewsUsageCache.set(cacheKey, {
          data: {
            allViews: allViews,
            total_count: totalCount,
            total_views: totalViews,
            date_range: dateRange,
          },
          timestamp: now,
        });

        return NextResponse.json({
          views: paginatedViews,
          total_count: totalCount,
          total_views: totalViews,
          page,
          limit,
          total_pages: Math.ceil(totalCount / limit),
          date_range: dateRange,
        });

      } catch (error) {
        console.error('[Views Usage API] Unexpected error:', error);
        return NextResponse.json(
          { 
            error: 'Failed to fetch views usage',
            views: [],
            total_count: 0,
            total_views: 0,
          },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: true,
    }
  );
}
