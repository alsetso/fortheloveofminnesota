import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/api-routes
 * Get all API routes with their status
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // TODO: Fetch from database table admin.api_routes
        // For now, return hardcoded routes
        const routes = [
          { path: '/api/feed/pin-activity', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
          { path: '/api/maps/live/mentions', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
          { path: '/api/maps', method: 'GET', isEnabled: true, requiresAuth: false, system: 'maps' },
          { path: '/api/maps/[id]/pins', method: 'GET', isEnabled: true, requiresAuth: false, system: 'maps' },
          { path: '/api/analytics/homepage-stats', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
          { path: '/api/feed', method: 'GET', isEnabled: true, requiresAuth: true, system: 'feeds' },
          { path: '/api/stories', method: 'GET', isEnabled: true, requiresAuth: true, system: 'stories' },
          { path: '/api/social', method: 'GET', isEnabled: true, requiresAuth: true, system: 'social_graph' },
          { path: '/api/messaging', method: 'GET', isEnabled: true, requiresAuth: true, system: 'messaging' },
          { path: '/api/pages', method: 'GET', isEnabled: true, requiresAuth: true, system: 'pages' },
          { path: '/api/places', method: 'GET', isEnabled: true, requiresAuth: false, system: 'places' },
          { path: '/api/ad_center', method: 'GET', isEnabled: true, requiresAuth: true, system: 'ads' },
          { path: '/api/analytics', method: 'GET', isEnabled: true, requiresAuth: true, system: 'analytics' },
          { path: '/api/gov', method: 'GET', isEnabled: true, requiresAuth: false, system: 'civic' },
        ];

        return NextResponse.json({ routes });
      } catch (error) {
        console.error('[Admin API Routes API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}

/**
 * PATCH /api/admin/api-routes
 * Update API route enabled status
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { routePath, method, isEnabled } = await req.json();
        
        if (!routePath || !method || typeof isEnabled !== 'boolean') {
          return NextResponse.json(
            { error: 'Invalid request: routePath, method, and isEnabled required' },
            { status: 400 }
          );
        }

        // TODO: Update database table admin.api_routes
        // For now, return success

        return NextResponse.json({ success: true, routePath, method, isEnabled });
      } catch (error) {
        console.error('[Admin API Routes API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
