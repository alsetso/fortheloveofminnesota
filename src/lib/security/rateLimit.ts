/**
 * Centralized rate limiting middleware for API routes
 * Uses in-memory cache (can be upgraded to Redis for scale)
 */

interface RateLimitEntry {
  timestamp: number;
  count: number;
  userId?: string;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
}

// In-memory cache: key -> RateLimitEntry
const rateLimitCache = new Map<string, RateLimitEntry>();

// Cleanup interval: remove entries older than 2x the longest window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const cleanupThreshold = now - (10 * 60 * 1000); // 10 minutes
    for (const [key, entry] of rateLimitCache.entries()) {
      if (entry.timestamp < cleanupThreshold) {
        rateLimitCache.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Public routes (no auth)
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Authenticated routes
  authenticated: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  },
  // Admin routes
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500,
  },
  // Webhook routes (no rate limiting, signature verified)
  webhook: {
    windowMs: 60 * 1000,
    maxRequests: Infinity,
  },
  // Strict rate limit for sensitive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
} as const;

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  
  // Generate cache key
  let cacheKey: string;
  if (config.keyGenerator) {
    cacheKey = config.keyGenerator(request);
  } else if (userId) {
    cacheKey = `user:${userId}`;
  } else {
    cacheKey = `ip:${getClientIP(request)}`;
  }
  
  // Clean up old entries for this key
  const entry = rateLimitCache.get(cacheKey);
  if (entry) {
    const windowStart = now - config.windowMs;
    if (entry.timestamp < windowStart) {
      // Window expired, reset
      rateLimitCache.set(cacheKey, {
        timestamp: now,
        count: 1,
        userId,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowMs,
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.timestamp + config.windowMs,
      };
    }
    
    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.timestamp + config.windowMs,
    };
  }
  
  // First request
  rateLimitCache.set(cacheKey, {
    timestamp: now,
    count: 1,
    userId,
  });
  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt: now + config.windowMs,
  };
}

/**
 * Rate limit middleware for Next.js route handlers
 * Returns rate limit headers and 429 response if exceeded
 */
export function withRateLimit(
  config: RateLimitConfig,
  userId?: string
) {
  return async (request: Request): Promise<{
    allowed: boolean;
    headers: Headers;
    response?: Response;
  }> => {
    const result = checkRateLimit(request, config, userId);
    const headers = new Headers();
    
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
    
    if (!result.allowed) {
      const resetSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
      return {
        allowed: false,
        headers,
        response: new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${resetSeconds} seconds.`,
            retryAfter: resetSeconds,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(headers.entries()),
              'Retry-After': resetSeconds.toString(),
            },
          }
        ),
      };
    }
    
    return {
      allowed: true,
      headers,
    };
  };
}

