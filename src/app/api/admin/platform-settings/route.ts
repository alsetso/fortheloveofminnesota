import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/platform-settings
 * Get platform settings
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // TODO: Fetch from database table admin.platform_settings
        // For now, return defaults
        const settings = {
          maintenanceMode: false,
          maintenanceMessage: 'We are currently performing maintenance. Please check back soon.',
          allowNewRegistrations: true,
          allowNewMaps: true,
          allowNewPins: true,
          requireEmailVerification: false,
          maxPinsPerMap: null,
          maxMapsPerAccount: null,
        };

        return NextResponse.json({ settings });
      } catch (error) {
        console.error('[Admin Platform Settings API] Error:', error);
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
 * PATCH /api/admin/platform-settings
 * Update platform settings
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const updates = await req.json();
        const supabase = await createServerClientWithAuth(cookies());
        
        // TODO: Update database table admin.platform_settings
        // For now, return success

        return NextResponse.json({ success: true, updates });
      } catch (error) {
        console.error('[Admin Platform Settings API] Error:', error);
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
