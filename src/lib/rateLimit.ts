/**
 * Simple in-memory rate limiter for API routes
 * 
 * For production at scale, consider upgrading to Redis-based solution
 * (e.g., @upstash/ratelimit or rate-limiter-flexible with Redis)
 */

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: string; // Optional custom identifier (defaults to IP)
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (clears on server restart)
// For production at scale, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier for rate limiting
 * Uses IP address, falling back to user ID if authenticated
 */
function getClientIdentifier(request: Request, userId?: string): string {
  // Prefer user ID if authenticated (more accurate)
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  
  const ip = cfIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : null) || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * Returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
  userId?: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const identifier = options.identifier || getClientIdentifier(request, userId);
  const key = `${identifier}:${options.windowMs}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry or reset if window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + options.windowMs,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  const allowed = entry.count <= options.maxRequests;
  const remaining = Math.max(0, options.maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit presets for common use cases
 */
export const RateLimitPresets = {
  // Strict: 10 requests per minute (for auth endpoints)
  strict: { windowMs: 60 * 1000, maxRequests: 10 },
  
  // Moderate: 60 requests per minute (for general API endpoints)
  moderate: { windowMs: 60 * 1000, maxRequests: 60 },
  
  // Analytics: 100 requests per minute (for tracking endpoints)
  analytics: { windowMs: 60 * 1000, maxRequests: 100 },
  
  // Generous: 200 requests per minute (for public read endpoints)
  generous: { windowMs: 60 * 1000, maxRequests: 200 },
  
  // Per hour limits for expensive operations
  hourly: { windowMs: 60 * 60 * 1000, maxRequests: 1000 },
} as const;

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number,
  maxRequests?: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': (maxRequests || 100).toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
  };
}


