import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/navigation
 * Get all navigation items
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // TODO: Fetch from database table admin.navigation_items
        // For now, return hardcoded items
        const items = [
          { id: 'nav-left-home', label: 'Love of Minnesota', href: '/', location: 'left', isVisible: true, requiresAuth: false },
          { id: 'nav-left-friends', label: 'Friends', href: '/friends', location: 'left', isVisible: true, requiresAuth: true },
          { id: 'nav-left-saved', label: 'Saved', href: '/saved', location: 'left', isVisible: true, requiresAuth: true },
          { id: 'nav-left-memories', label: 'Memories', href: '/memories', location: 'left', isVisible: true, requiresAuth: true },
          { id: 'nav-left-pages', label: 'Pages', href: '/pages', location: 'left', isVisible: true, requiresAuth: true },
          { id: 'nav-left-stories', label: 'Stories', href: '/stories', location: 'left', isVisible: true, requiresAuth: true },
          { id: 'nav-left-docs', label: 'Documentation', href: '/docs', location: 'left', isVisible: true, requiresAuth: false },
          { id: 'nav-header-home', label: 'Home', href: '/', location: 'header', isVisible: true, requiresAuth: false },
          { id: 'nav-header-maps', label: 'Maps', href: '/maps', location: 'header', isVisible: true, requiresAuth: false },
          { id: 'nav-header-explore', label: 'Explore', href: '/explore', location: 'header', isVisible: true, requiresAuth: false },
          { id: 'nav-header-people', label: 'People', href: '/people', location: 'header', isVisible: true, requiresAuth: false },
          { id: 'nav-header-gov', label: 'Government', href: '/gov', location: 'header', isVisible: true, requiresAuth: false },
        ];

        return NextResponse.json({ items });
      } catch (error) {
        console.error('[Admin Navigation API] Error:', error);
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
 * PATCH /api/admin/navigation
 * Update navigation item visibility
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { itemId, isVisible } = await req.json();
        
        if (!itemId || typeof isVisible !== 'boolean') {
          return NextResponse.json(
            { error: 'Invalid request: itemId and isVisible required' },
            { status: 400 }
          );
        }

        // TODO: Update database table admin.navigation_items
        // For now, return success

        return NextResponse.json({ success: true, itemId, isVisible });
      } catch (error) {
        console.error('[Admin Navigation API] Error:', error);
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
