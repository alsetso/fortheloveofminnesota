import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

/**
 * Creates a standardized error response for API routes
 */
export function createErrorResponse(
  error: string,
  status: number,
  details?: string
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = { error };
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
}

/**
 * Creates a standardized success response for API routes
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}

