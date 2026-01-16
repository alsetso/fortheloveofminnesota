import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * POST /api/admin/buildings/upload-image
 * Upload building image
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
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          return createErrorResponse('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.', 400);
        }

        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          return createErrorResponse('File size exceeds 5MB limit', 400);
        }

        const supabase = createServiceClient();
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${fileExt}`;
        const filePath = `buildings/${fileName}`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('civic_building_cover')
          .upload(filePath, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Buildings API] Error uploading:', error);
          }
          return createErrorResponse('Failed to upload image', 500);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('civic_building_cover')
          .getPublicUrl(filePath);

        return createSuccessResponse({
          path: urlData.publicUrl,
          fileName: filePath,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Buildings API] Error:', error);
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

