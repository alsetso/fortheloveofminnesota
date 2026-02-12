import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/migrate-pin-media/[pinId]
 * Migrate pin media from legacy buckets to pins-media bucket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { pinId } = await params;
        const supabase = await createServerClientWithAuth(cookies());
        // Use service client for storage operations (bypasses RLS)
        const serviceSupabase = createServiceClient();

        // Query maps.pins using RPC function - fetch in batches until we find the pin
        let pin: any = null;
        let offset = 0;
        const batchSize = 100;
        let found = false;

        // Try to find the pin by querying in batches
        while (!found && offset < 10000) { // Safety limit
          const { data: queryResult, error: queryError } = await supabase.rpc('query_table', {
            p_schema_name: 'maps',
            p_table_name: 'pins',
            p_limit: batchSize,
            p_offset: offset,
            p_order_by: null,
            p_order_direction: 'ASC',
            p_search: null,
            p_filters: null,
          });

          if (queryError) {
            console.error('[Migrate Pin Media] RPC Error:', queryError);
            break;
          }

          if (queryResult && queryResult[0]) {
            const resultRow = queryResult[0];
            const dataArray = resultRow?.data || [];
            const pins = Array.isArray(dataArray) ? dataArray : [];
            
            pin = pins.find((p: any) => p.id === pinId);
            if (pin) {
              found = true;
              break;
            }

            // If we got fewer results than batchSize, we've reached the end
            if (pins.length < batchSize) {
              break;
            }
          } else {
            break;
          }

          offset += batchSize;
        }

        if (!pin) {
          console.error('[Migrate Pin Media] Pin not found:', pinId);
          return NextResponse.json(
            { error: 'Pin not found', details: `Pin ID ${pinId} not found in maps.pins table` },
            { status: 404 }
          );
        }

        // Get user_id from author_account_id (storage policy requires user_id, not account_id)
        let userId: string | null = null;
        if (pin.author_account_id) {
          const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('user_id')
            .eq('id', pin.author_account_id)
            .single();

          if (accountError || !account) {
            console.warn('[Migrate Pin Media] Could not find account:', pin.author_account_id, accountError);
            // Fallback: try to use account_id as user_id (in case they're the same)
            userId = pin.author_account_id;
          } else {
            userId = account.user_id;
          }
        }

        if (!userId) {
          return NextResponse.json(
            { error: 'Could not determine user ID for pin owner' },
            { status: 400 }
          );
        }

        let migratedFiles = 0;
        const updates: Record<string, string> = {};

        // Helper to detect content type from file extension
        const detectContentType = (filename: string): string => {
          const ext = filename.toLowerCase().split('.').pop() || '';
          const mimeTypes: Record<string, string> = {
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            // Videos
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'wmv': 'video/x-ms-wmv',
            'ogg': 'video/ogg',
            '3gp': 'video/3gpp',
            'mkv': 'video/x-matroska',
          };
          return mimeTypes[ext] || 'application/octet-stream';
        };

        // Helper to migrate a file URL
        const migrateFileUrl = async (oldUrl: string | null): Promise<string | null> => {
          if (!oldUrl) return null;

          // Check if already in new bucket
          if (oldUrl.includes('pins-media')) {
            return oldUrl;
          }

          // Extract bucket and path from old URL
          const urlMatch = oldUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
          if (!urlMatch) {
            console.warn('Could not parse URL:', oldUrl);
            return oldUrl; // Return original if can't parse
          }

          const [, oldBucket, filePath] = urlMatch;
          
          // Only migrate from legacy buckets
          const legacyBuckets = ['map-pins-media', 'mentions-media', 'pins-media', 'user-map-video-storage'];
          if (!legacyBuckets.includes(oldBucket)) {
            return oldUrl; // Not a legacy bucket, keep as-is
          }

          try {
            // Get file from old bucket (use service client to bypass RLS)
            const { data: fileData, error: fileError } = await serviceSupabase.storage
              .from(oldBucket)
              .download(filePath);

            if (fileError || !fileData) {
              console.warn('Could not download file:', filePath, fileError);
              return oldUrl; // Return original if download fails
            }

            // Determine new path structure: {user_id}/pins/{pin_id}/{filename}
            // Use the userId we fetched earlier (from account.user_id)
            const filename = filePath.split('/').pop() || 'file';
            const newPath = `${userId}/pins/${pinId}/${filename}`;

            // Detect content type from extension (more reliable than fileData.type for legacy files)
            const contentType = detectContentType(filename) || fileData.type || 'application/octet-stream';

            // Upload to new bucket using service client (bypasses RLS)
            const { error: uploadError } = await serviceSupabase.storage
              .from('pins-media')
              .upload(newPath, fileData, {
                upsert: true,
                contentType,
              });

            if (uploadError) {
              console.warn('Could not upload file:', newPath, uploadError);
              return oldUrl; // Return original if upload fails
            }

            // Get public URL for new file (can use either client for this)
            const { data: urlData } = serviceSupabase.storage
              .from('pins-media')
              .getPublicUrl(newPath);

            if (urlData?.publicUrl) {
              migratedFiles++;
              return urlData.publicUrl;
            }

            return oldUrl;
          } catch (err) {
            console.error('Migration error:', err);
            return oldUrl; // Return original on error
          }
        };

        // Migrate each media URL
        if (pin.image_url) {
          const newUrl = await migrateFileUrl(pin.image_url);
          if (newUrl !== pin.image_url) {
            updates.image_url = newUrl;
          }
        }

        if (pin.video_url) {
          const newUrl = await migrateFileUrl(pin.video_url);
          if (newUrl !== pin.video_url) {
            updates.video_url = newUrl;
          }
        }

        if (pin.icon_url) {
          const newUrl = await migrateFileUrl(pin.icon_url);
          if (newUrl !== pin.icon_url) {
            updates.icon_url = newUrl;
          }
        }

        // Update pin with new URLs if any were migrated
        if (Object.keys(updates).length > 0) {
          // Use RPC function to update maps.pins (works across schemas)
          const { error: updateError } = await serviceSupabase.rpc('update_pin_media', {
            p_pin_id: pinId,
            p_image_url: updates.image_url || null,
            p_video_url: updates.video_url || null,
            p_icon_url: updates.icon_url || null,
          });

          if (updateError) {
            console.error('[Migrate Pin Media] Update failed:', updateError);
            // Files are migrated successfully - DB update failed but files exist
            return NextResponse.json({
              success: true,
              migrated_files: migratedFiles,
              updates,
              warning: 'Files migrated successfully, but database update failed.',
              update_error: updateError.message,
            });
          }
        }

        return NextResponse.json({
          success: true,
          migrated_files: migratedFiles,
          updates,
        });
      } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Migration failed' },
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
