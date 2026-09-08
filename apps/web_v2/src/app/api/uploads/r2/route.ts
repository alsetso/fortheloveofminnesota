import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  getR2BucketName,
  getR2Client,
  missingR2EnvKeys,
  R2_OBJECT_CACHE_CONTROL,
  R2_PRESIGN_EXPIRES_IN,
  r2PublicUrlForKey,
} from '@/lib/r2/r2';
import {
  buildR2ObjectKey,
  isAllowedR2ContentType,
  maxBytesForContentType,
  normalizeR2ContentType,
  sanitizeUploadFilename,
  type R2ObjectKind,
} from '@/lib/r2/presignHelpers';

export const runtime = 'nodejs';

type Body = {
  filename?: string;
  contentType?: string;
  byteSize?: number;
  /** Default `posts`. Use `pins` for map pin media. */
  kind?: R2ObjectKind;
};

function badRequest(
  error: string,
  fields: { contentType: string; byteSize: number | string; filename: string },
) {
  console.warn('[uploads/r2] 400', { error, ...fields });
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const filename = typeof body.filename === 'string' ? body.filename : '';
    const rawContentType =
      typeof body.contentType === 'string' ? body.contentType.trim() : '';
    const byteSize = typeof body.byteSize === 'number' ? body.byteSize : NaN;
    const kind: R2ObjectKind =
      body.kind === 'pins' ? 'pins' : body.kind === 'pages' ? 'pages' : 'posts';
    const logFields = {
      contentType: rawContentType,
      byteSize: Number.isFinite(byteSize) ? byteSize : String(body.byteSize),
      filename,
    };

    if (!sanitizeUploadFilename(filename)) {
      return badRequest('Invalid filename', logFields);
    }

    // ContentType is a signed PutObject param — normalize once and echo it back
    // so the client PUT header matches the signature exactly.
    const contentType = normalizeR2ContentType(rawContentType);
    if (!contentType || !isAllowedR2ContentType(rawContentType)) {
      return badRequest('Unsupported file type', logFields);
    }
    if (!Number.isFinite(byteSize) || byteSize <= 0 || !Number.isInteger(byteSize)) {
      return badRequest('Invalid file size', logFields);
    }
    const max = maxBytesForContentType(contentType);
    if (byteSize > max) {
      return badRequest(
        contentType.startsWith('video/')
          ? 'Video is too large (max 100 MB).'
          : 'Photo is too large (max 15 MB).',
        logFields,
      );
    }
    if (kind === 'pages' && contentType.startsWith('video/')) {
      return badRequest('Page media must be an image', logFields);
    }

    const key = buildR2ObjectKey({
      authUserId: session.userId,
      kind,
      filename,
      contentType,
    });

    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
        CacheControl: R2_OBJECT_CACHE_CONTROL,
      }),
      { expiresIn: R2_PRESIGN_EXPIRES_IN },
    );

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl: r2PublicUrlForKey(key),
      /** Exact MIME signed into the PUT URL — client must send this Content-Type. */
      contentType,
      expiresIn: R2_PRESIGN_EXPIRES_IN,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    const missing = missingR2EnvKeys();
    // Only treat R2 setup failures as 503 — not unrelated "Missing …" auth errors.
    if (missing.length > 0 || /\bR2_[A-Z_]+\b/.test(message) || /R2 credentials missing/i.test(message)) {
      console.error('[uploads/r2] media storage not configured', {
        missing,
        message,
      });
      return NextResponse.json({ error: 'Media storage is not configured' }, { status: 503 });
    }
    console.error('[uploads/r2]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
