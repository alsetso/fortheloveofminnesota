import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * POST /api/admin/atlas-types/upload-icon
 * Upload atlas type icon
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 10MB (for file uploads)
 * - File type and size validation
 * - Requires admin role
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
          return createErrorResponse('No file provided', 400);
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
          return createErrorResponse('Invalid file type. Allowed: PNG, JPEG, GIF, WebP, SVG', 400);
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          return createErrorResponse('File size exceeds 5MB limit', 400);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;

        // Upload to Supabase storage
        const supabase = createServiceClient();
        const { data, error } = await supabase.storage
          .from('atlas_icons_storage')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Atlas Types Upload] Error uploading file:', error);
          }
          return createErrorResponse('Failed to upload file', 500);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('atlas_icons_storage')
          .getPublicUrl(fileName);

        return createSuccessResponse({
          path: urlData.publicUrl,
          fileName: fileName,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Atlas Types Upload] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.formData, // 10MB for file uploads
    }
  );
}

