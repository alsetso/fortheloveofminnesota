/**
 * Standardized API error handling utilities
 */

import { NextResponse } from 'next/server';

export interface ApiError {
  error: string;
  details?: string;
  status?: number;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: string
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error,
      ...(details && { details }),
      ...(status && { status }),
    },
    { status }
  );
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, defaultMessage: string = 'Internal server error'): NextResponse<ApiError> {
  if (error instanceof Error) {
    console.error(`[API Error] ${defaultMessage}:`, error.message);
    return createErrorResponse(defaultMessage, 500, error.message);
  }
  
  console.error(`[API Error] ${defaultMessage}:`, error);
  return createErrorResponse(defaultMessage, 500, 'Unknown error');
}

