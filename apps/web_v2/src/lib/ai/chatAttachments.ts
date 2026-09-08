/** Chat attachment types for AI Responses multimodal input. */

export const AI_CHAT_MEDIA_BUCKET = 'ai-chat-media';

export const CHAT_ATTACHMENT_MAX_COUNT = 4;
export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_PDF_MAX_BYTES = 20 * 1024 * 1024;

export const CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export type ChatAttachmentMime = (typeof CHAT_ATTACHMENT_MIME_TYPES)[number];

export type ChatAttachmentKind = 'image' | 'pdf';

export type ChatAttachment = {
  id: string;
  public_url: string;
  mime_type: string;
  original_name: string | null;
  file_size: number | null;
  kind: ChatAttachmentKind;
};

export function normalizeChatAttachmentMime(raw: string): ChatAttachmentMime | null {
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'image/jpg') return 'image/jpeg';
  if ((CHAT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(base)) {
    return base as ChatAttachmentMime;
  }
  return null;
}

export function chatAttachmentKind(mime: string): ChatAttachmentKind {
  return mime === 'application/pdf' ? 'pdf' : 'image';
}

export function maxBytesForChatMime(mime: string): number {
  return mime === 'application/pdf' ? CHAT_PDF_MAX_BYTES : CHAT_IMAGE_MAX_BYTES;
}

export function extensionForChatMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export function sanitizeChatFilename(name: string): string {
  const base = name.split(/[/\\]/).pop()?.trim() || 'file';
  return base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 120) || 'file';
}

export function parseAttachmentsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ChatAttachment[] {
  const raw = meta?.attachments;
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : null;
    const publicUrl = typeof r.public_url === 'string' ? r.public_url : null;
    const mime = typeof r.mime_type === 'string' ? r.mime_type : '';
    if (!id || !publicUrl) continue;
    out.push({
      id,
      public_url: publicUrl,
      mime_type: mime,
      original_name: typeof r.original_name === 'string' ? r.original_name : null,
      file_size: typeof r.file_size === 'number' ? r.file_size : null,
      kind: chatAttachmentKind(mime),
    });
  }
  return out;
}
