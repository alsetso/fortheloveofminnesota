/**
 * Input validation utilities using Zod
 * Provides common validation schemas and sanitization helpers
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').min(3).max(100),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  positiveInt: z.number().int().positive('Must be a positive integer'),
  nonNegativeInt: z.number().int().nonnegative('Must be a non-negative integer'),
  pagination: z.object({
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  dateString: z.string().datetime('Invalid date format'),
  jsonString: z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON string',
      });
      return z.NEVER;
    }
  }),
};

/**
 * Sanitize string input
 * Removes control characters and trims whitespace
 */
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize HTML input (basic)
 * For production, use DOMPurify or similar
 */
export function sanitizeHTML(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate and parse request body
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  maxSize: number = 1024 * 1024 // 1MB default
): Promise<{ success: true; data: T } | { success: false; error: Response }> {
  try {
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: 'Request body too large' }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: result.error.issues,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    
    return {
      success: false,
      error: new Response(
        JSON.stringify({ error: 'Failed to parse request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: Response } {
  const params: Record<string, string | string[]> = {};
  
  for (const [key, value] of searchParams.entries()) {
    if (params[key]) {
      // Multiple values - convert to array
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  }
  
  const result = schema.safeParse(params);
  
  if (!result.success) {
    return {
      success: false,
        error: new Response(
          JSON.stringify({
            error: 'Invalid query parameters',
            details: result.error.issues,
          }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
  
  return { success: true, data: result.data };
}

/**
 * Validate path parameters
 */
export function validatePathParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: Response } {
  const result = schema.safeParse(params);
  
  if (!result.success) {
    return {
      success: false,
        error: new Response(
          JSON.stringify({
            error: 'Invalid path parameters',
            details: result.error.issues,
          }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
  
  return { success: true, data: result.data };
}

