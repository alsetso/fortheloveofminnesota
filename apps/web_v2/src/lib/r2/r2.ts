import { S3Client } from '@aws-sdk/client-s3';

export { R2_OBJECT_CACHE_CONTROL, R2_PRESIGN_EXPIRES_IN } from '@/lib/r2/constants';

const R2_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'NEXT_PUBLIC_R2_PUBLIC_URL',
] as const;

/**
 * Dynamic lookup so Next does not bake `undefined` into the server bundle when
 * a secret was absent at compile time (common on Vercel before env is set).
 */
function readEnv(name: (typeof R2_ENV_KEYS)[number]): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Which R2 env keys are empty — for 503 diagnostics (never log values). */
export function missingR2EnvKeys(): string[] {
  return R2_ENV_KEYS.filter((key) => !readEnv(key));
}

let _client: S3Client | null = null;

/** Lazy singleton so Next build/static analysis does not require R2 secrets at import time. */
export function getR2Client(): S3Client {
  if (_client) return _client;
  const accountId = readEnv('R2_ACCOUNT_ID');
  const accessKeyId = readEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) {
    const missing = [
      !accountId && 'R2_ACCOUNT_ID',
      !accessKeyId && 'R2_ACCESS_KEY_ID',
      !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
    ].filter(Boolean);
    throw new Error(`R2 credentials missing (${missing.join(', ')})`);
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function getR2BucketName(): string {
  const name = readEnv('R2_BUCKET_NAME');
  if (!name) throw new Error('R2_BUCKET_NAME missing');
  return name;
}

export function getR2PublicBaseUrl(): string {
  const base = readEnv('NEXT_PUBLIC_R2_PUBLIC_URL')?.replace(/\/+$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_R2_PUBLIC_URL missing');
  return base;
}

export function r2PublicUrlForKey(key: string): string {
  return `${getR2PublicBaseUrl()}/${key.replace(/^\/+/, '')}`;
}
