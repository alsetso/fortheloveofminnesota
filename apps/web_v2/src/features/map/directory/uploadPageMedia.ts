import { COMMUNITY_POST_PHOTO_MAX_BYTES } from '@/lib/community/composeMediaLimits';
import { R2_OBJECT_CACHE_CONTROL } from '@/lib/r2/constants';
import {
  extensionForUpload,
  normalizeR2ContentType,
} from '@/lib/r2/presignHelpers';
import type { PageMediaPrimaryRole } from '@/lib/directory/pageMediaRoles';

/** Same ceiling as community post photos — R2 already allows this. */
const PAGE_IMAGE_MAX_BYTES = COMMUNITY_POST_PHOTO_MAX_BYTES;

export type PageMediaUploadResult = {
  publicUrl: string;
  key: string;
};

type PresignResponse = {
  uploadUrl?: string;
  key?: string;
  publicUrl?: string;
  contentType?: string;
  error?: string;
};

function putBytes(uploadUrl: string, file: File, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Cache-Control', R2_OBJECT_CACHE_CONTROL);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network)'));
    xhr.send(file);
  });
}

async function requestPresign(opts: {
  filename: string;
  contentType: string;
  byteSize: number;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string; contentType: string }> {
  const res = await fetch('/api/uploads/r2', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...opts, kind: 'pages' }),
  });
  const json = (await res.json()) as PresignResponse;
  if (!res.ok) throw new Error(json.error ?? 'Could not start upload');
  if (!json.uploadUrl || !json.key || !json.publicUrl || !json.contentType) {
    throw new Error('Invalid upload response');
  }
  return {
    uploadUrl: json.uploadUrl,
    key: json.key,
    publicUrl: json.publicUrl,
    contentType: json.contentType,
  };
}

/**
 * Upload a page logo or cover image to R2 (`pages` key prefix).
 * Caller persists the URL via POST /api/directory/pages/[id]/media.
 */
export async function uploadDirectoryPageImage(
  file: File,
  role: PageMediaPrimaryRole,
): Promise<PageMediaUploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.');
  }
  if (file.size > PAGE_IMAGE_MAX_BYTES) {
    throw new Error('Image is too large (max 15 MB).');
  }

  const contentType = normalizeR2ContentType(file.type) ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('Unsupported image type.');
  }

  const filename =
    file.name || `page-${role}.${extensionForUpload('upload', contentType)}`;

  const presign = await requestPresign({
    filename,
    contentType,
    byteSize: file.size,
  });

  await putBytes(presign.uploadUrl, file, presign.contentType);
  return { publicUrl: presign.publicUrl, key: presign.key };
}
