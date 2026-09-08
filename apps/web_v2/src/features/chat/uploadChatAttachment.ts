import {
  CHAT_ATTACHMENT_MAX_COUNT,
  maxBytesForChatMime,
  normalizeChatAttachmentMime,
  type ChatAttachment,
} from '@/lib/ai/chatAttachments';

export type PendingChatAttachment = ChatAttachment & {
  /** Local object URL for image preview before/after upload. */
  previewUrl?: string | null;
  uploading?: boolean;
  error?: string | null;
};

export async function uploadChatAttachment(
  file: File,
  opts?: { threadId?: string | null },
): Promise<ChatAttachment> {
  const mime = normalizeChatAttachmentMime(file.type || '') ?? mimeFromName(file.name);
  if (!mime) {
    throw new Error('Unsupported file type. Use an image or PDF.');
  }
  if (file.size > maxBytesForChatMime(mime)) {
    throw new Error(
      mime === 'application/pdf'
        ? 'PDF is too large (max 20 MB).'
        : 'Image is too large (max 10 MB).',
    );
  }

  const form = new FormData();
  // Ensure the server sees a known MIME even when the OS leaves type blank.
  const blob =
    file.type && normalizeChatAttachmentMime(file.type)
      ? file
      : new File([file], file.name, { type: mime });
  form.append('file', blob);
  if (opts?.threadId) form.append('thread_id', opts.threadId);

  const res = await fetch('/api/ai/attachments', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    attachment?: ChatAttachment;
  };
  if (!res.ok || !json.attachment) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.attachment;
}

export function canAddChatAttachment(currentCount: number): boolean {
  return currentCount < CHAT_ATTACHMENT_MAX_COUNT;
}

function mimeFromName(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  return null;
}

/** Keep only image/PDF files from a FileList or drag payload. */
export function filterChatAttachmentFiles(files: Iterable<File>): File[] {
  const out: File[] = [];
  for (const file of files) {
    const mime = normalizeChatAttachmentMime(file.type || '') ?? mimeFromName(file.name);
    if (mime) out.push(file);
  }
  return out;
}

/**
 * Append + upload files into pending attachment state (shared by picker + drag-drop).
 */
export async function enqueueChatAttachments(opts: {
  files: File[];
  current: PendingChatAttachment[];
  threadId?: string | null;
  onChange: (next: PendingChatAttachment[]) => void;
}): Promise<void> {
  const accepted = filterChatAttachmentFiles(opts.files);
  if (accepted.length === 0) return;

  let current = [...opts.current];
  const room = CHAT_ATTACHMENT_MAX_COUNT - current.length;
  const batch = accepted.slice(0, Math.max(0, room));

  for (const file of batch) {
    const tempId = `pending_${crypto.randomUUID()}`;
    const resolvedMime =
      normalizeChatAttachmentMime(file.type || '') ?? mimeFromName(file.name) ?? file.type;
    const previewUrl = resolvedMime.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;
    const pending: PendingChatAttachment = {
      id: tempId,
      public_url: previewUrl || '',
      mime_type: resolvedMime,
      original_name: file.name,
      file_size: file.size,
      kind: resolvedMime === 'application/pdf' ? 'pdf' : 'image',
      previewUrl,
      uploading: true,
    };
    current = [...current, pending];
    opts.onChange(current);

    try {
      const uploaded = await uploadChatAttachment(file, {
        threadId: opts.threadId,
      });
      current = current.map((a) =>
        a.id === tempId
          ? {
              ...uploaded,
              previewUrl: previewUrl ?? uploaded.public_url,
              uploading: false,
              error: null,
            }
          : a,
      );
      opts.onChange(current);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      current = current.map((a) =>
        a.id === tempId ? { ...a, uploading: false, error: message } : a,
      );
      opts.onChange(current);
    }
  }
}
