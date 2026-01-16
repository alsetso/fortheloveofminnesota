import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * POST /api/proxy/zillow/search
 * Proxy route for Zillow API address search
 * 
 * Security:
 * - Rate limited: 60 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Server-only API key
 */
const zillowSearchSchema = z.object({
  address: z.string().min(1).max(500),
});

const RAPIDAPI_HOST = 'zillow56.p.rapidapi.com';

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId }) => {
      try {
        // Get server-only API key
        const apiKey = getApiKey('RAPIDAPI');
        
        // Validate request body
        const validation = await validateRequestBody(req, zillowSearchSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { address } = validation.data;
        
        // Build URL
        const url = `https://${RAPIDAPI_HOST}/search_address?address=${encodeURIComponent(address)}`;
        
        // Proxy request to RapidAPI
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          const statusCode = response.status >= 500 ? 502 : response.status;
          
          if (process.env.NODE_ENV === 'development') {
            console.error('Zillow API error:', {
              status: response.status,
              error: errorText,
            });
          }
          
          return NextResponse.json(
            {
              error: 'Zillow API error',
              message: 'Failed to fetch data from Zillow API',
              status: response.status,
            },
            { status: statusCode }
          );
        }
        
        const data = await response.json();
        
        return NextResponse.json(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Zillow proxy error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true, // Require authentication for Zillow
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
