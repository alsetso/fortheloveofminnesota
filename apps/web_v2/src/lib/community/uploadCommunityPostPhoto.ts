import {
  assertMediaFile,
  COMMUNITY_POST_PHOTO_MAX_BYTES,
  COMMUNITY_POST_VIDEO_MAX_BYTES,
} from '@/lib/community/composeMediaLimits';
import { R2_OBJECT_CACHE_CONTROL } from '@/lib/r2/constants';
import {
  extensionForUpload,
  normalizeR2ContentType,
} from '@/lib/r2/presignHelpers';

/** @deprecated Supabase bucket name — kept for any legacy references. */
export const POSTS_MEDIA_BUCKET = 'posts-media';

export type CommunityMediaUploadResult = {
  publicUrl: string;
  key: string;
};

export type UploadCommunityPostMediaOptions = {
  /** Object key prefix folder: posts (default) or pins. */
  kind?: 'posts' | 'pins';
  onProgress?: (ratio: number) => void;
};

type PresignResponse = {
  uploadUrl?: string;
  key?: string;
  publicUrl?: string;
  /** Normalized MIME echoed from the server — must match signed PutObject ContentType. */
  contentType?: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * PUT bytes to the presigned URL. `contentType` must be the value echoed from
 * `/api/uploads/r2` (ContentType is included in the SigV4 signature).
 */
function putWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Cache-Control', R2_OBJECT_CACHE_CONTROL);
    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable || ev.total <= 0) return;
      onProgress(Math.min(1, ev.loaded / ev.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network)'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(file);
  });
}

async function requestPresign(opts: {
  filename: string;
  contentType: string;
  byteSize: number;
  kind: 'posts' | 'pins';
}): Promise<{ uploadUrl: string; key: string; publicUrl: string; contentType: string }> {
  const res = await fetch('/api/uploads/r2', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const json = (await res.json()) as PresignResponse;
  // Presign 4xx/5xx must surface immediately — do not retry this POST.
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not start upload');
  }
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
 * Presign once → PUT to R2 (retry/backoff wraps PUT only).
 * On PUT 403/expired, re-presign once then continue PUT retries.
 * Returns public URL + object key for `community.post_media`.
 */
export async function uploadCommunityPostMedia(
  file: File,
  _authUserId: string,
  options: UploadCommunityPostMediaOptions = {},
): Promise<CommunityMediaUploadResult> {
  const bad = assertMediaFile(file);
  if (bad) throw new Error(bad);

  const isVideo = file.type.startsWith('video/');
  const max = isVideo ? COMMUNITY_POST_VIDEO_MAX_BYTES : COMMUNITY_POST_PHOTO_MAX_BYTES;
  if (file.size > max) {
    throw new Error(isVideo ? 'Video is too large (max 100 MB).' : 'Photo is too large (max 15 MB).');
  }

  const kind = options.kind ?? 'posts';
  const contentType =
    normalizeR2ContentType(file.type) ??
    (isVideo ? 'video/mp4' : 'image/jpeg');
  const filename =
    file.name ||
    `upload.${extensionForUpload('upload', contentType)}`;

  // Presign is outside the PUT retry loop — a 400 here throws once, no backoff.
  let presign = await requestPresign({
    filename,
    contentType,
    byteSize: file.size,
    kind,
  });

  const maxAttempts = 3;
  let lastError: Error | null = null;
  let rePresigned = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await putWithProgress(
        presign.uploadUrl,
        file,
        presign.contentType,
        options.onProgress,
      );
      return { publicUrl: presign.publicUrl, key: presign.key };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Upload failed');
      const msg = lastError.message.toLowerCase();
      const likelyExpired = msg.includes('403') || msg.includes('expired');
      // Re-presign only after a PUT auth failure — never as a response to presign 400.
      if (likelyExpired && !rePresigned) {
        rePresigned = true;
        presign = await requestPresign({
          filename,
          contentType,
          byteSize: file.size,
          kind,
        });
        continue;
      }
      if (attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Upload failed');
}

/** @deprecated Use {@link uploadCommunityPostMedia}. */
export const uploadCommunityPostPhoto = uploadCommunityPostMedia;
