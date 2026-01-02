/**
 * Server-side rate limiting for news API
 * Uses in-memory cache to prevent excessive calls
 */

interface RateLimitEntry {
  timestamp: number;
  count: number;
}

// In-memory cache: IP -> RateLimitEntry
const rateLimitCache = new Map<string, RateLimitEntry>();

// Rate limit: 10 requests per 60 seconds per IP (relaxed for better UX)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  // Try various headers for IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to a default key if no IP found
  return 'unknown';
}

/**
 * Check if request is within rate limit
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(request: Request): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const ip = getClientIP(request);
  const now = Date.now();
  
  // Clean up old entries (older than 2x the window)
  const cleanupThreshold = now - (RATE_LIMIT_WINDOW_MS * 2);
  for (const [key, entry] of rateLimitCache.entries()) {
    if (entry.timestamp < cleanupThreshold) {
      rateLimitCache.delete(key);
    }
  }
  
  const entry = rateLimitCache.get(ip);
  
  if (!entry) {
    // First request from this IP
    rateLimitCache.set(ip, {
      timestamp: now,
      count: 1,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }
  
  // Check if window has expired
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  if (entry.timestamp < windowStart) {
    // Window expired, reset
    rateLimitCache.set(ip, {
      timestamp: now,
      count: 1,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.timestamp + RATE_LIMIT_WINDOW_MS,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetAt: entry.timestamp + RATE_LIMIT_WINDOW_MS,
  };
}

