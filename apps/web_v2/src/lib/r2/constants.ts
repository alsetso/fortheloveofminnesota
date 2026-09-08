/** Immutable object keys → long CDN cache on the public custom domain. */
export const R2_OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Presigned PUT lifetime — covers ~100MB video on slow cellular + a few retries. */
export const R2_PRESIGN_EXPIRES_IN = 900;
