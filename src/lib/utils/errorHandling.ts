/**
 * Standardized error handling utilities for explore pages
 */

/**
 * Handles database query errors with consistent logging
 * Returns empty array as fallback to prevent page crashes
 */
export function handleQueryError<T>(
  error: unknown,
  context: string,
  fallback: T
): T {
  if (error) {
    console.error(`[${context}] Error:`, error);
  }
  return fallback;
}

/**
 * Wraps a database query with error handling
 * Returns the data or fallback value on error
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  context: string,
  fallback: T
): Promise<T> {
  try {
    const result = await queryFn();
    if (result.error) {
      return handleQueryError(result.error, context, fallback);
    }
    return result.data || fallback;
  } catch (error) {
    return handleQueryError(error, context, fallback);
  }
}






