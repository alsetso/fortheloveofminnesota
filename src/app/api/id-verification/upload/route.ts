import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * POST /api/id-verification/upload
 * Upload a document for ID verification
 * 
 * Body: FormData with:
 * - file: File (image or PDF)
 * - account_id: string
 * - verification_id?: string (optional, for updating existing verification)
 * - document_type: 'state_id_front' | 'state_id_back' | 'billing_statement_front' | 'billing_statement_back'
 * 
 * Security:
 * - Rate limited: 50 requests/minute (authenticated)
 * - Requires authentication
 * - Max file size: 10MB
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const accountIdParam = formData.get('account_id') as string | null;
        const verificationIdParam = formData.get('verification_id') as string | null;
        const documentType = formData.get('document_type') as string | null;

        if (!file) {
          return NextResponse.json(
            { error: 'File is required' },
            { status: 400 }
          );
        }

        if (!documentType) {
          return NextResponse.json(
            { error: 'document_type is required' },
            { status: 400 }
          );
        }

        const validDocumentTypes = [
          'state_id_front',
          'state_id_back',
          'billing_statement_front',
          'billing_statement_back',
        ];

        if (!validDocumentTypes.includes(documentType)) {
          return NextResponse.json(
            { error: 'Invalid document_type' },
            { status: 400 }
          );
        }

        // Validate file type
        const validMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
        ];

        if (!validMimeTypes.includes(file.type)) {
          return NextResponse.json(
            { error: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.' },
            { status: 400 }
          );
        }

        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          return NextResponse.json(
            { error: 'File size exceeds 10MB limit' },
            { status: 400 }
          );
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Use account_id from form data if provided, otherwise use context accountId
        let targetAccountId = accountId;
        if (accountIdParam) {
          // Verify the account belongs to the user
          const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', accountIdParam)
            .eq('user_id', userId)
            .maybeSingle();

          if (accountError || !account) {
            return NextResponse.json(
              { error: 'Account not found or access denied' },
              { status: 403 }
            );
          }
          type AccountRow = { id: string };
          targetAccountId = (account as AccountRow).id;
        }

        // Generate file path
        const fileExt = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        
        let filePath: string;
        if (verificationIdParam) {
          // Update existing verification
          filePath = `${targetAccountId}/${verificationIdParam}/${documentType}/${timestamp}-${randomStr}.${fileExt}`;
        } else {
          // New verification - create a temporary path
          filePath = `${targetAccountId}/temp/${documentType}/${timestamp}-${randomStr}.${fileExt}`;
        }

        // Upload to Supabase storage
        const fileBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('id-verification-documents')
          .upload(filePath, fileBuffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          console.error('[ID Verification Upload] Upload error:', uploadError);
          return NextResponse.json(
            { error: `Failed to upload file: ${uploadError.message}` },
            { status: 500 }
          );
        }

        // Get signed URL (private bucket, so we need signed URL)
        const { data: urlData, error: urlError } = await supabase.storage
          .from('id-verification-documents')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (urlError || !urlData) {
          console.error('[ID Verification Upload] URL error:', urlError);
          return NextResponse.json(
            { error: 'Failed to generate file URL' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          url: urlData.signedUrl,
          path: filePath,
          document_type: documentType,
        });
      } catch (error) {
        console.error('[ID Verification Upload] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
      maxRequestSize: 10 * 1024 * 1024, // 10MB
    }
  );
}
