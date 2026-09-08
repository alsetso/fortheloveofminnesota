/**
 * Migrate community.post_media bytes → Cloudflare R2 and rewrite urls.
 *
 * Usage (from apps/ios):
 *   node --env-file=.env.local scripts/migrate-post-media-to-r2.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-post-media-to-r2.mjs --apply
 *
 * Idempotent: skips rows already on R2 (meta.storage=r2 or r2 public URL).
 * Keeps prior URL in meta.migrated_from for rollback.
 */
import { PutObjectCommand, S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY = args.has('--dry-run') || !APPLY;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const R2_ACCOUNT_ID = requireEnv('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY');
const R2_BUCKET_NAME = requireEnv('R2_BUCKET_NAME');
const R2_PUBLIC = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL').replace(/\/+$/, '');

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const REST = `${SUPABASE_URL}/rest/v1`;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function restJson(path, init = {}) {
  const res = await fetch(`${REST}${path}`, {
    ...init,
    headers: headers(init.headers),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`REST ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

function alreadyOnR2(row) {
  const url = String(row.url ?? '');
  const storage = row.meta && typeof row.meta === 'object' ? row.meta.storage : null;
  return storage === 'r2' || url.includes('r2.dev/') || url.includes('cloudflarestorage.com/');
}

function extFromContentType(ct, fallback = 'bin') {
  const base = (ct || '').split(';')[0].trim().toLowerCase();
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return map[base] ?? fallback;
}

function extFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const raw = path.split('.').pop()?.toLowerCase() ?? '';
    if (/^[a-z0-9]{2,5}$/.test(raw)) return raw === 'jpeg' ? 'jpg' : raw;
  } catch {
    /* ignore */
  }
  return null;
}

async function loadBytes(row) {
  const url = String(row.url ?? '');
  if (url.startsWith('data:')) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m) throw new Error('Invalid data URI');
    const contentType = (m[1] || 'application/octet-stream').trim();
    const isB64 = Boolean(m[2]);
    const data = m[3] ?? '';
    const body = isB64
      ? Buffer.from(data, 'base64')
      : Buffer.from(decodeURIComponent(data), 'utf8');
    return { body, contentType };
  }
  if (!/^https?:\/\//i.test(url)) throw new Error('Unsupported URL scheme');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
  const contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    (row.media_type === 'video' ? 'video/mp4' : 'image/jpeg');
  const ab = await res.arrayBuffer();
  return { body: Buffer.from(ab), contentType };
}

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (e) {
    if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false;
    return false;
  }
}

function buildKey(row, contentType) {
  const ext =
    extFromUrl(String(row.url)) ||
    extFromContentType(contentType, row.media_type === 'video' ? 'mp4' : 'jpg');
  const account = row.account_id || 'unknown';
  return `migrated/${account}/${row.id}.${ext}`;
}

async function main() {
  console.log(
    JSON.stringify(
      {
        mode: DRY ? 'dry-run' : 'apply',
        bucket: R2_BUCKET_NAME,
        publicBase: R2_PUBLIC,
      },
      null,
      2,
    ),
  );

  // Prefer Accept-Profile / Content-Profile for community schema.
  const rows = await restJson(
    '/post_media?select=id,post_id,account_id,url,media_type,meta,sort_order,created_at&order=created_at.asc',
    { headers: { 'Accept-Profile': 'community' } },
  );

  const targets = (rows ?? []).filter((r) => !alreadyOnR2(r));
  console.log(`total=${rows?.length ?? 0} need_migrate=${targets.length}`);

  const summary = { ok: 0, failed: [] };

  for (const row of targets) {
    const label = `${row.id} (${row.media_type})`;
    try {
      const { body, contentType } = await loadBytes(row);
      if (!body.length) throw new Error('Empty body');
      const key = buildKey(row, contentType);
      const publicUrl = `${R2_PUBLIC}/${key}`;
      const prevMeta =
        row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
          ? { ...row.meta }
          : {};

      console.log(
        `${DRY ? '[dry]' : '[put]'} ${label} bytes=${body.length} → ${key}`,
      );

      if (!DRY) {
        const exists = await objectExists(key);
        if (!exists) {
          await r2.send(
            new PutObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: key,
              Body: body,
              ContentType: contentType,
              CacheControl: CACHE_CONTROL,
            }),
          );
        }

        const nextMeta = {
          ...prevMeta,
          storage: 'r2',
          key,
          migrated_from: String(row.url).startsWith('data:')
            ? `data:${contentType};base64,<omitted ${body.length} bytes>`
            : String(row.url),
          migrated_at: new Date().toISOString(),
        };

        await restJson(`/post_media?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: {
            'Accept-Profile': 'community',
            'Content-Profile': 'community',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ url: publicUrl, meta: nextMeta }),
        });

        if (row.post_id && !String(row.url).startsWith('data:')) {
          const posts = await restJson(
            `/posts?id=eq.${row.post_id}&select=id,meta`,
            { headers: { 'Accept-Profile': 'community' } },
          );
          const post = posts?.[0];
          const meta =
            post?.meta && typeof post.meta === 'object' ? { ...post.meta } : null;
          const layers = meta?.media_text_layers;
          if (layers && typeof layers === 'object' && row.url in layers) {
            const nextLayers = { ...layers };
            nextLayers[publicUrl] = nextLayers[row.url];
            delete nextLayers[row.url];
            meta.media_text_layers = nextLayers;
            await restJson(`/posts?id=eq.${row.post_id}`, {
              method: 'PATCH',
              headers: {
                'Accept-Profile': 'community',
                'Content-Profile': 'community',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ meta }),
            });
          }
        }
      }

      summary.ok += 1;
    } catch (e) {
      summary.failed.push({
        id: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
      console.error(`[fail] ${label}`, e instanceof Error ? e.message : e);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
