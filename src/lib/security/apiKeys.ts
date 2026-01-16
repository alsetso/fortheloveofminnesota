/**
 * Secure API key handling utilities
 * Ensures API keys are never exposed to client-side code
 */

/**
 * Get server-only API key (throws if not found)
 * These keys should NEVER use NEXT_PUBLIC_ prefix
 */
export function getServerApiKey(keyName: string): string {
  const key = process.env[keyName];
  
  if (!key) {
    throw new Error(`Missing required API key: ${keyName}`);
  }
  
  // Warn if key uses NEXT_PUBLIC_ prefix (security issue)
  if (keyName.startsWith('NEXT_PUBLIC_')) {
    console.warn(
      `⚠️  SECURITY WARNING: API key ${keyName} uses NEXT_PUBLIC_ prefix. ` +
      `This exposes the key to client-side code. Use a server-only env var instead.`
    );
  }
  
  return key;
}

/**
 * Get server-only API key (returns null if not found)
 */
export function getServerApiKeyOptional(keyName: string): string | null {
  return process.env[keyName] || null;
}

/**
 * Check if API key is configured
 */
export function hasApiKey(keyName: string): boolean {
  return !!process.env[keyName];
}

/**
 * Mask API key for logging (shows only first 4 and last 4 characters)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Validate API key format (basic checks)
 */
export function validateApiKeyFormat(key: string, expectedPrefix?: string): boolean {
  if (!key || key.length < 10) {
    return false;
  }
  
  if (expectedPrefix && !key.startsWith(expectedPrefix)) {
    return false;
  }
  
  return true;
}

/**
 * API key configuration for external services
 */
export const API_KEYS = {
  // OpenAI (should be server-only)
  OPENAI: {
    envVar: 'OPENAI_API_KEY', // Changed from NEXT_PUBLIC_OPENAI_API_KEY
    required: true,
    description: 'OpenAI API key for chat completions',
  },
  
  // RapidAPI (should be server-only)
  RAPIDAPI: {
    envVar: 'RAPIDAPI_KEY', // Changed from NEXT_PUBLIC_RAPIDAPI_KEY
    required: true,
    description: 'RapidAPI key for skip trace, Zillow, and news APIs',
  },
  
  // Stripe (server-only)
  STRIPE_SECRET: {
    envVar: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key for server-side operations',
  },
  
  STRIPE_WEBHOOK: {
    envVar: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    description: 'Stripe webhook signing secret',
  },
  
  // Supabase (server-only)
  SUPABASE_SERVICE: {
    envVar: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (bypasses RLS)',
  },
  
  // Mapbox (public is acceptable for map service)
  MAPBOX: {
    envVar: 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
    required: true,
    description: 'Mapbox access token (public is acceptable for map service)',
  },
} as const;

/**
 * Get API key for a service
 */
export function getApiKey(service: keyof typeof API_KEYS): string {
  const config = API_KEYS[service];
  return getServerApiKey(config.envVar);
}

