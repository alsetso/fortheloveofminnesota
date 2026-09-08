import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import {
  AI_CHAT_MEDIA_BUCKET,
  CHAT_ATTACHMENT_MAX_COUNT,
  extensionForChatMime,
  maxBytesForChatMime,
  normalizeChatAttachmentMime,
  sanitizeChatFilename,
  chatAttachmentKind,
} from '@/lib/ai/chatAttachments';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createAiServerClient } from '@/lib/supabase/aiDb';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/ai/attachments
 * multipart/form-data: file (+ optional thread_id)
 * Uploads to `ai-chat-media` and inserts `ai.ai_media`.
 */
export async function POST(request: Request) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const mime = normalizeChatAttachmentMime(file.type || '');
    if (!mime) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use an image or PDF.' },
        { status: 400 },
      );
    }

    const maxBytes = maxBytesForChatMime(mime);
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error:
            mime === 'application/pdf'
              ? 'PDF is too large (max 20 MB).'
              : 'Image is too large (max 10 MB).',
        },
        { status: 400 },
      );
    }

    const rawThreadId = form.get('thread_id');
    const threadId =
      typeof rawThreadId === 'string' && isUuid(rawThreadId) ? rawThreadId : null;

    const ai = createAiServerClient();
    if (threadId) {
      const { data: thread } = await ai
        .from('subject_threads')
        .select('id, account_id')
        .eq('id', threadId)
        .maybeSingle();
      if (!thread || thread.account_id !== session.accountId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
    }

    const ext = extensionForChatMime(mime);
    const mediaId = crypto.randomUUID();
    const originalName = sanitizeChatFilename(file.name || `file.${ext}`);
    const storagePath = `${session.accountId}/${threadId ?? 'inbox'}/${mediaId}.${ext}`;

    const storage = createServiceRoleClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await storage.storage
      .from(AI_CHAT_MEDIA_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mime,
        upsert: false,
        cacheControl: '31536000',
      });

    if (uploadErr) {
      console.error('[ai/attachments] upload', uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: urlData } = storage.storage
      .from(AI_CHAT_MEDIA_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const { data: row, error: insertErr } = await ai
      .from('ai_media')
      .insert({
        id: mediaId,
        account_id: session.accountId,
        thread_id: threadId,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mime,
        file_size: file.size,
        original_name: originalName,
      })
      .select(
        'id, public_url, mime_type, original_name, file_size, thread_id, created_at',
      )
      .single();

    if (insertErr || !row) {
      console.error('[ai/attachments] insert', insertErr);
      await storage.storage.from(AI_CHAT_MEDIA_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: insertErr?.message ?? 'Failed to save attachment' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        attachment: {
          id: row.id,
          public_url: row.public_url,
          mime_type: row.mime_type,
          original_name: row.original_name,
          file_size: row.file_size,
          kind: chatAttachmentKind(String(row.mime_type ?? mime)),
        },
        maxCount: CHAT_ATTACHMENT_MAX_COUNT,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[ai/attachments]', err);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
