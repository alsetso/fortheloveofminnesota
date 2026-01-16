import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { getApiKey } from '@/lib/security/apiKeys';
import { z } from 'zod';

/**
 * POST /api/address
 * Geocode address using Skip Trace API
 * 
 * Security:
 * - Rate limited: 10 requests/minute (strict) - prevent API quota exhaustion
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Server-only API key handling
 * - Consider requiring authentication to prevent abuse
 */
const addressSchema = z.object({
  street: z.string().min(1).max(200),
  citystatezip: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, addressSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { street, citystatezip } = validation.data;
        
        // Get server-only API key
        let apiKey: string;
        try {
          apiKey = getApiKey('RAPIDAPI');
        } catch (error) {
          return NextResponse.json(
            { error: 'RapidAPI key not configured' },
            { status: 500 }
          );
        }
        
        // Call the Skip Trace API
        const encodedStreet = encodeURIComponent(street);
        const encodedCityStateZip = encodeURIComponent(citystatezip);
        const url = `https://skip-tracing-working-api.p.rapidapi.com/search/byaddress?street=${encodedStreet}&citystatezip=${encodedCityStateZip}&page=1`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'skip-tracing-working-api.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Skip Trace API error:', response.status, response.statusText);
          }
          return NextResponse.json(
            { error: 'Failed to geocode address' },
            { status: response.status }
          );
        }

        const data = await response.json();
        
        // Return the data with records count for status checking
        return NextResponse.json({
          ...data,
          records: data.Records || 0,
          status: data.Status || 200
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Address API error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 10 requests/minute - prevent API quota exhaustion
      requireAuth: false, // Public for now, but consider requiring auth
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
